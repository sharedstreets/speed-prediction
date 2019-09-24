 // example control route monitor
const OSRM = require("osrm");
const { exec } = require("child_process");

async function run() {
  var routes = [
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

  const update = 'cd graph; ../node_modules/osrm/lib/binding/osrm-contract sf.osrm --segment-speed-file ../profiles/{{csv}} --core 0.5; cd ..'

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const profile = "./profiles/" + day + "-" + hour;

      const cmd = update.split('{{csv}}').join(day+'-'+hour)
      await exec(cmd)

      const osrm = new OSRM('./graph/sf.osrm')

      for (let route of routes) {
        var result = osrm.route([route.a, route.b])
        if (result && result.routes) {
          console.log(result.routes[0])
        }
      }
    }
  }
}

run();
