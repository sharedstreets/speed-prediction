// example control route monitor
const path = require("path");
const OSRM = require("osrm");
const { execSync } = require("child_process");

async function run() {
  var trips = [
    {
      name: "Oakland -> SF",
      a: [-122.28905439376832, 37.810962152170354],
      b: [-122.39932537078857, 37.77702418710145],
      data: []
    },
    {
      name: "Market -> Presidio",
      a: [-122.40949630737303, 37.782960004647364],
      b: [-122.46045827865599, 37.79562714086835],
      data: []
    },
    {
      name: "Embarcadero -> Potrero Hill",
      a: [-122.3928666114807, 37.792956539788726],
      b: [-122.39866018295287, 37.75988395932576],
      data: []
    },
    {
      name: "Haight -> Mission",
      a: [-122.44803428649902, 37.76984969147692],
      b: [-122.41857290267943, 37.75308952880576],
      data: []
    },
    {
      name: "Bernal -> Marina",
      a: [-122.41327285766602, 37.74074598958579],
      b: [-122.44331359863283, 37.802256596712596],
      data: []
    }
  ];

  const update =
    "cd graph; ../node_modules/osrm/lib/binding/osrm-customize sf.osrm --segment-speed-file ../profiles/{{csv}}; cd ..";

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      console.log(day + "-" + hour);
      const profile = "./profiles/" + day + "-" + hour;

      const cmd = update.split("{{csv}}").join(day + "-" + hour);
      execSync(cmd);

      const osrm = new OSRM({
        path: path.join(__dirname, "./graph/sf.osrm"),
        algorithm: "MLD"
      });

      for await (let trip of trips) {
        const eta = await getETA(osrm, trip.a, trip.b);
        trip.data.push(eta);
      }
    }
  }

  console.log(JSON.stringify(trips));
}

async function getETA(osrm, a, b) {
  return new Promise((resolve, reject) => {
    osrm.route({ coordinates: [a, b] }, (err, result) => {
      if (result && result.routes) {
        resolve(result.routes[0].duration);
      } else resolve(0);
    });
  });
}

run();
