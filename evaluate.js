const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

function readFileAsDataURL(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  return "data:image/png;base64," + imageBuffer.toString("base64");
}

function readObjAsDataURL(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString("base64");
  return `data:application/octet-stream;base64,${base64}`;
}

async function fetchAndRotateImage(imageUrl) {
  const response = await axios({ url: imageUrl, responseType: "arraybuffer" });
  const rotatedImageBuffer = await sharp(response.data).rotate(-90).toBuffer();
  fs.writeFileSync("tempImage.png", rotatedImageBuffer);
}

async function fetchOBJFile(objUrl) {
  const response = await axios({ url: objUrl, responseType: "arraybuffer" });
  fs.writeFileSync("tempObj.obj", response.data);
}

async function calculateLandmarkDistances(imageUrl, objUrl) {
  let results;
  try {
    await fetchAndRotateImage(imageUrl);
    await fetchOBJFile(objUrl);

    const imageFilePath = "tempImage.png";
    const imageDataUrl = readFileAsDataURL(imageFilePath);

    const objFilePath = "tempObj.obj";
    const objDataUrl = readObjAsDataURL(objFilePath);

    const browser = await puppeteer.launch({
      headless: false,
    });
    // const page = await browser.newPage();
    const page = await browser.pages().then((pages) => pages[0]);

    // await page.addScriptTag({
    //   url: "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.min.js",
    // });
    // await page.addScriptTag({
    //   url: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.min.js",
    // });
    // await page.addScriptTag({
    //   url: "https://cdnjs.cloudflare.com/ajax/libs/three.js/87/three.min.js",
    // });
    // await page.addScriptTag({
    //   url: "https://cdn.rawgit.com/mrdoob/three.js/r87/examples/js/loaders/OBJLoader.js",
    // });

    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.onload = resolve;
        script.onerror = reject;
        script.src =
          "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.min.js";
        document.head.appendChild(script);
      });
    });
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.onload = resolve;
        script.onerror = reject;
        script.src =
          "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.min.js";
        document.head.appendChild(script);
      });
    });
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.onload = resolve;
        script.onerror = reject;
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/three.js/87/three.min.js";
        document.head.appendChild(script);
      });
    });
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.onload = resolve;
        script.onerror = reject;
        script.src =
          "https://cdn.rawgit.com/mrdoob/three.js/r87/examples/js/loaders/OBJLoader.js";
        document.head.appendChild(script);
      });
    });

    const scriptContent = fs.readFileSync(path.join(__dirname, "process.js"), {
      encoding: "utf8",
    });
    await page.evaluate(scriptContent);

    const results = await page.evaluate(
      async (imageDataUrl, objDataUrl) => {
        return await main(imageDataUrl, objDataUrl);
      },
      imageDataUrl,
      objDataUrl
    );

    // await browser.close();
  } catch (error) {
    console.error("Error in calculateLandmarkDistances: ", error);
    await new Promise((resolve) => setTimeout(resolve, 100000));
  }

  return results;
}

// Example usage
const IMAGE_URL =
  "https://ins-ai-speech.s3.ap-northeast-2.amazonaws.com/prod/v2/M06/S2501/F001/M06_S2501_F001.png";
const OBJ_URL =
  "https://ins-ai-speech.s3.ap-northeast-2.amazonaws.com/prod/v2/M06/S2501/F001/M06_S2501_F001.obj";

calculateLandmarkDistances(IMAGE_URL, OBJ_URL).then((results) => {
  console.log("Landmark distances:", results);
});
