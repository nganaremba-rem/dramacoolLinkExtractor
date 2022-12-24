const express = require("express");
const app = express();
const puppeteer = require("puppeteer");

const port = process.env.PORT || 4000;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

const getLinks = async (movieLink) => {
  try {
    // open browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // open new tab and goto the link
    const page = await browser.newPage();
    console.log("Browser Launched");
    await page.goto(movieLink, { waitUntil: "domcontentloaded", timeout: 0 });
    console.log("Link open");

    // get all the episodes links
    const episodeLinks = await page.$$eval(".all-episode > li", (list) => {
      console.log("Getting episode page link");
      list.reverse();
      return list.map((currentList) => currentList.children[0].href);
    });

    const finalLinks = await Promise.all(
      episodeLinks.map(async (episode, index) => {
        let newPage = await browser.newPage();
        await newPage.goto(episode, {
          waitUntil: "domcontentloaded",
          timeout: 0,
        });
        console.log("Opening index: " + index);
        //   get the link
        const link = await newPage.$eval(
          "#frame_wrap > iframe",
          (iframe) => iframe.src,
        );
        // get the title
        const title = await newPage.$eval(
          ".watch-drama > h1",
          (h1) => h1.textContent,
        );
        console.log({ title, link });

        return {
          link,
          title,
        };
      }),
    );
    await browser.close();
    console.log("Finished");
    if (finalLinks.length) return { status: true, data: finalLinks };
    return { message: "Link not Valid", status: false };
  } catch (err) {
    console.log(err.message);
  }
};

app.get("/", (req, res) => {
  console.log("Get /");
  res.render("index");
});

app.post("/", async (req, res) => {
  console.log("POST /");
  const HOST = "dramacool.sr";
  const link = req.body.link;
  const url = new URL(link);
  if (HOST !== url.host)
    return res.render("index", {
      episodeLinks: {
        status: false,
        message: "Only dramacool.sr links are supported",
      },
    });
  const episodeLinks = await getLinks(link);
  return res.render("index", { episodeLinks });
});

app.listen(port, () => console.log(`Server is listening on port ${port}`));
