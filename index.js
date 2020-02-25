const massive = require("massive");
require("dotenv").config();
const puppeteer = require("puppeteer");
const { DB_STRING } = process.env;
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const csv = require("csvtojson");
const { performance } = require("perf_hooks");

const scrapeNps = async () => {
  //scrapes the nps from podium

  console.log("hit univar scraper");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });
  const page = await browser.newPage();
  await page.goto("https://www.uim2.com/login?f=uim-app", { waitUntil: "networkidle2" });



for(let i=0;i<9;i++){

    await page.keyboard.press("Tab");
}

await page.keyboard.type(process.env.UV_USER)
await page.keyboard.press("Tab");
await page.keyboard.type(process.env.UV_PASS)

await page.evaluate(() => {
  document.querySelector("button[type='submit']").click();
});

await page.waitForSelector('#hexagon_4')

await page.goto('https://www.uim2.com/uim-app/reports/inventory')

await page.waitForSelector('img')
await page.evaluate(async ()=>{
    await document.querySelectorAll('img[src="https://www.uim2.com/images/reports/rep-320.png"]')[0].click()

})

  return;

  await page.evaluate(() => {
    document.getElementById("passwordInput");
  });
  await page.keyboard.type(process.env.P_PASS);
  await page.evaluate(() => {
    document.getElementById("signInButton").click();
  });

  await page.waitForSelector("#selenium-insights");

  await page.goto(process.env.P_SECRET_URL, { waitUntil: "networkidle2" });
  await page.waitFor(10000);

  await page.goto(process.env.P_D_URL, { waitUntil: "networkidle2" });

  await page.waitForSelector("i.icon-wrench");
  await page.evaluate(async () => {
    await document.querySelector("i.icon-wrench").click();

    await document.querySelectorAll("div.db-text-body.label")[1].click();
    await document.getElementById("export-csv").click();
  });
  await page.waitFor(3000);
  await browser.close();
  console.log("browser shut down");
};

const addNps = async (db, seed) => {
  //change me

  const csvFilePath = path.resolve(
    __dirname,
    "../../../Downloads/NPS+Export+(Based+on+Service+Date).csv"
  );
  const jsonArray = await csv().fromFile(csvFilePath);
  let filtered;
  let promises = [];
  if (!seed) {
    filtered = jsonArray.filter(el => {
      return (
        moment(el["Response Date"]).format("YYYY-MM-DD") >=
        moment()
          .startOf("month")
          .format("YYYY-MM-DD")
      );
    });
  } else {
    filtered = jsonArray;
  }
  console.log(filtered.length, "array length");
  for (let i = 0; i < filtered.length; i++) {
    let base = filtered[i];
    //db adder
    console.log("progress", i, "/", filtered.length);
    //add in logic to check the add date. only add from yesterday?
    let identifier = await JSON.stringify({
      invite: base["Invite Date"],
      res: base["Response Date"],
      phone: base["Phone"],
      loc: base["Location"],
      tech: base["Technician"],
      customer: base["Customer Name"],
      rating: +base["Rating"],
      comment: base["Comment"]
    });

    try {
      await db.add_nps([
        base["Invite Date"],
        base["Response Date"],
        base["Phone"],
        base["Location"],
        base["Technician"],
        base["Customer Name"],
        +base["Rating"],
        base["Comment"],
        identifier
      ]);
      // promises.push(
      //   db.add_nps([
      //     base["Invite Date"],
      //     base["Response Date"],
      //     base["Phone"],
      //     base["Location"],
      //     base["Technician"],
      //     base["Customer Name"],
      //     +base["Rating"],
      //     base["Comment"],
      //     identifier
      //   ])
      // );
    } catch (error) {
      console.log(error, "error with podium adder");
    }

    //delete downloaded file
  }
  Promise.all(promises).then(() => {});
};

const attNps = async db => {
  let employees = await db.query(
    "select first_name, last_name, proutes_id from employees where proutes_type !=2 and is_active=1 "
  );

  console.log(employees.length, "emp length");
  // and is_active=1
  let promises = [];
  let start = performance.now();
  console.log(start / 1000, "start time");
  for (let i = 0; i < employees.length; i++) {
    let likeStr = `${employees[i].first_name.replace(
      employees[i].first_name.charAt(0),
      "%_"
    )}%${employees[i].last_name.replace(
      employees[i].last_name.charAt(0),
      "_"
    )}%`;
    // console.log(likeStr, i);
    // promises.push(db.att_podium_nps([employees[i].proutes_id, likeStr]));

    await db.att_podium_nps([employees[i].proutes_id, likeStr]);
  }

  Promise.all(promises).then(() => {
    let finish = performance.now();

    try {
      const delPath = path.resolve(
        __dirname,
        "../../../Downloads/NPS+Export+(Based+on+Service+Date).csv"
      );
      fs.unlinkSync(delPath);
      console.log("file deleted");
    } catch (error) {
      console.log(error, "err with delete");
    }
    console.log(`time taken ${finish - start} millis`);
    console.log("att nps finished, file deleted");
  });
};

const fireAll = async () => {
  let database = await massive({
    connectionString: DB_STRING,
    ssl: true
  });
  await scrapeNps();
  //   await addNps(database);
  //   await attNps(database);
};
fireAll();
