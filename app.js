const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertStateToResponse = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

const convertDistrictToResponse = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  //console.log(authHeader.split(" ")[1]);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  //console.log(jwtToken);
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY SECRET KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //console.log(payload);
        //request.username = payload.username;
        next();
      }
    });
  }
};

//API1 login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(selectQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatch = await bcrypt.compare(password, dbUser.password);
    if (passwordMatch === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY SECRET KEY");
      response.send({ jwtToken });
    }
  }
});

//API2 states
app.get("/states/", authentication, async (request, response) => {
  //const { username } = request;
  const stateQuery = `
    select * from state;`;
  const dbResponse = await db.all(stateQuery);
  response.send(dbResponse.map((each) => convertStateToResponse(each)));
});

//API3

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `select * from state
    where state_id=${stateId};`;
  const dbResponse = await db.get(stateQuery);
  response.send(convertStateToResponse(dbResponse));
});

//API 4
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
    insert into district(
        district_name,
        state_id,cases,cured,active,deaths
    ) values(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`;
  const dbResponse = await db.run(addDistrictQuery);
  const districtId = dbResponse.lastID;
  console.log(districtId);
  response.send("District Successfully Added");
});

//API 5 get district
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const selectQuery = `select * from district
    where district_id=${districtId};`;
    const dbResponse = await db.get(selectQuery);
    response.send(convertDistrictToResponse(dbResponse));
  }
);

//API 6 delete
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `delete from district
    where district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7 update district
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
    update district set
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    where district_id=${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8 states stats
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
    select sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths from district
    where state_id=${stateId};`;
    const dbResponse = await db.get(query);
    response.send(dbResponse);
  }
);

module.exports = app;
