const parser = require("osm-pbf-parser");
const fs = require("fs");
const level = require("level");
const through2 = require("through2");
const byline = require("byline");
const moment = require("moment");
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

async function run() {
  var db = level("data");

  console.log("osm");
  await osm(db);
  console.log("segments");
  await segments(db);
  console.log("junctions");
  await junctions(db);
  console.log("hourly 2018-10");
  await hourly(
    db,
    "2018-10",
    "movement-speeds-hourly-san-francisco-2018-10.csv"
  );
  console.log("hourly 2018-11");
  await hourly(
    db,
    "2018-11",
    "movement-speeds-hourly-san-francisco-2018-11.csv"
  );
  console.log("hourly 2018-12");
  await hourly(
    db,
    "2018-12",
    "movement-speeds-hourly-san-francisco-2018-12.csv"
  );
  console.log("quarterly 2019-Q2");
  await quarterly(
    db,
    "2019-Q2",
    "movement-speeds-quarterly-by-hod-san-francisco-2019-Q2.csv"
  );
  console.log("digest");
  await digest(db);*/
  console.log("predict");
  await predict(db);
  console.log('profile')
  await profile(db)
}

async function digest(db) {
  var stats = {
    max: -Infinity,
    types: {}
  };

  const segments = db.createReadStream({ gt: "d!", lt: "d?" });
  for await (let item of segments) {
    const keys = item.key.split("!");
    const speed = +item.value;
    const type = keys.slice(4, keys.length).join("!");
    if (speed > stats.max) {
      stats.max = speed;
    }

    stats.types[type] = 1;
  }

  await db.put("?", JSON.stringify(stats));
  return stats;
}

async function predict(db) {
  const stats = require('./stats.json')//JSON.parse(await db.get("?"));
  var last = "";
  var data = {};
  const segments = db.createReadStream({ gt: "d!", lt: "d?" });
  for await (let item of segments) {
    const keys = item.key.split("!");
    const id = keys.slice(1, 4).join("!");

    if (last !== id) {
      var speeds = {}
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          if(!speeds[day]) speeds[day] = {}
          const speed = getSpeed(day, hour, data)

          if(speed) speeds[day][hour] = speed
        }
      }
      await db.put('p!'+last, JSON.stringify(speeds))

      // reset
      last = id;
      data = {};
    }

    const speed = +item.value;
    const type = keys.slice(4, keys.length).join("!");
    data[type] = speed;
  }
}

function getSpeed (day, hour, data) {
  var quarter, h1, h2, h3 // todo: use these for weighted averages
  const types = Object.keys(data)
  for (let type of types) {
    const keys = type.split('!')

    if (keys[0] === "2018-12") {
      // hourly
      const d = +moment(keys.slice(1, 4).join("-"), "YYYY-M-D").format("e");
      const h = +keys[4]

      if (d === day && h === hour && keys[5] === 'mean') {
        return data[type]
      }
    } else if (keys[0] === "2018-11") {
      // hourly
      const d = +moment(keys.slice(1, 4).join("-"), "YYYY-M-D").format("e");
      const h = +keys[4]

      if (d === day && h === hour && keys[5] === 'mean') {
        return data[type]
      }
    } else if (keys[0] === "2018-10") {
      // hourly
      const d = +moment(keys.slice(1, 4).join("-"), "YYYY-M-D").format("e");
      const h = +keys[4]

      if (d === day && h === hour && keys[5] === 'mean') {
        return data[type]
      }
    } else if (keys[0] === "2019-Q2" && keys[4] === 'mean') {
      //quarterly
      return data[type]
    }
  }
}

async function profile(db) {
  rimraf.sync('./profiles')
  mkdirp.sync('./profiles')
  const segments = db.createReadStream({ gt: "p!", lt: "p?" });
  for await (let item of segments) {
    speeds = JSON.parse(item.value);
    const keys = item.key.split("!");

    try {
      const wayId = await db.get("s!" + keys[1]);
      const way = JSON.parse(await db.get("w!" + wayId));

      const start = +(await db.get("j!" + keys[2]));
      const end = +(await db.get("j!" + keys[3]));
      const a = way.refs.indexOf(start);
      const b = way.refs.indexOf(end);

      if (a > -1 && b > -1) {
        if (b < a) {
          [a, b] = [b, a];
          way.refs = way.refs.reverse();
        }

        for (let i = a; i < b; i++) {
          const pair = [way.refs[i], way.refs[i + 1]].join(',');

          const days = Object.keys(speeds)
          for (let day of days) {
            const hours =  Object.keys(speeds[day])
            for (let hour of hours) {
              fs.appendFileSync('./profiles/'+day+'-'+hour,
              pair+','+Math.round(speeds[day][hour] * 1.60934)+ '\n')
            }
          }
        }
      }
    } catch (e) {}
  }
}

async function quarterly(db, prefix, file) {
  return new Promise(async (resolve, reject) => {
    var i = 0;
    fs.createReadStream(file)
      .pipe(byline.createStream())
      .pipe(
        through2(async (line, enc, next) => {
          i++;
          var p = Math.round((i / 5474129) * 100);
          if (i % 10000 === 0) console.log(p);
          const raw = line.toString().split(",");
          const record = {
            year: raw[0],
            quarter: raw[1],
            hour_of_day: raw[2],
            segment_id: raw[3],
            start_junction_id: raw[4],
            end_junction_id: raw[5],
            speed_mph_mean: +raw[6],
            speed_mph_stdev: +raw[7],
            speed_mph_p50: +raw[8],
            speed_mph_p85: +raw[9]
          };

          const id =
            "d!" +
            record.segment_id +
            "!" +
            record.start_junction_id +
            "!" +
            record.end_junction_id;

          const base =
            id +
            "!" +
            prefix +
            "!" +
            record.year +
            "!" +
            record.quarter +
            "!" +
            record.hour_of_day +
            "!";

          const batch = [
            {
              type: "put",
              key: base + "mean",
              value: record.speed_mph_mean
            },
            {
              type: "put",
              key: base + "stdev",
              value: record.speed_mph_stdev
            },
            {
              type: "put",
              key: base + "p50",
              value: record.speed_mph_p50
            },
            {
              type: "put",
              key: base + "p85",
              value: record.speed_mph_p50
            }
          ];

          await db.batch(batch);

          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

async function hourly(db, prefix, file) {
  return new Promise(async (resolve, reject) => {
    var i = 0;
    fs.createReadStream(file)
      .pipe(byline.createStream())
      .pipe(
        through2(async (line, enc, next) => {
          i++;
          var p = Math.round((i / 28429852) * 10000);
          if (i % 100000 === 0) console.log(p / 100 + "%");
          const raw = line.toString().split(",");
          const record = {
            year: raw[0],
            month: raw[1],
            day: raw[2],
            hour: raw[3],
            utc_timestamp: raw[4],
            segment_id: raw[5],
            start_junction_id: raw[6],
            end_junction_id: raw[7],
            speed_mph_mean: +raw[8],
            speed_mph_stdev: +raw[9]
          };

          const id =
            "d!" +
            record.segment_id +
            "!" +
            record.start_junction_id +
            "!" +
            record.end_junction_id;

          const base =
            id +
            "!" +
            prefix +
            "!" +
            record.year +
            "!" +
            record.month +
            "!" +
            record.day +
            "!" +
            record.hour +
            "!";

          const batch = [
            {
              type: "put",
              key: base + "mean",
              value: record.speed_mph_mean
            },
            {
              type: "put",
              key: base + "stdev",
              value: record.speed_mph_stdev
            }
          ];

          await db.batch(batch);

          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

async function osm(db) {
  return new Promise(async (resolve, reject) => {
    const parse = parser();
    fs.createReadStream("sf.osm.pbf")
      .pipe(parse)
      .pipe(
        through2.obj(async (items, enc, next) => {
          var batch = [];
          for (item of items) {
            if (item.type === "node") {
              batch.push({
                type: "put",
                key: "n!" + item.id,
                value: JSON.stringify(item)
              });
            } else if (item.type === "way") {
              batch.push({
                type: "put",
                key: "w!" + item.id,
                value: JSON.stringify(item)
              });
            }
          }

          await db.batch(batch);
          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

async function segments(db) {
  return new Promise(async (resolve, reject) => {
    fs.createReadStream("movement-segments-to-osm-ways-san-francisco-2018.csv")
      .pipe(byline.createStream())
      .pipe(
        through2(async (line, enc, next) => {
          const data = line.toString().split(",");
          var movementId = data[0];
          var wayId = data[1];
          await db.put("s!" + movementId, wayId);
          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

async function junctions(db) {
  return new Promise(async (resolve, reject) => {
    fs.createReadStream(
      "movement-junctions-to-osm-nodes-san-francisco-2018.csv"
    )
      .pipe(byline.createStream())
      .pipe(
        through2(async (line, enc, next) => {
          const data = line.toString().split(",");
          var movementId = data[0];
          var junctionId = data[1];
          await db.put("j!" + movementId, junctionId);
          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

run();
