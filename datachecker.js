const axios = require("axios");
const { logger } = require("./logger");

const BASE_URL =
  "https://ins-ai-speech.s3.ap-northeast-2.amazonaws.com/prod/v2/M06";
const SENTENCE_START = 2501;
const SENTENCE_END = 3000;
const MAX_FRAME_NUMBER = 999;

async function checkFile(url) {
  try {
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function checkPairs() {
  for (
    let sentenceNum = SENTENCE_START;
    sentenceNum <= SENTENCE_END;
    sentenceNum++
  ) {
    for (let frameNum = 0; frameNum <= MAX_FRAME_NUMBER; frameNum++) {
      let frameStr = String(frameNum).padStart(3, "0");
      let imageUrl = `${BASE_URL}/S${sentenceNum}/F${frameStr}/M06_S${sentenceNum}_F${frameStr}.png`;
      let objUrl = `${BASE_URL}/S${sentenceNum}/F${frameStr}/M06_S${sentenceNum}_F${frameStr}.obj`;

      let imageExists = await checkFile(imageUrl);
      let objExists = await checkFile(objUrl);

      if (imageExists && objExists) {
        console.log(`Pair found: Sentence ${sentenceNum}, Frame ${frameStr}`);
        // logger(`Pair found: Sentence ${sentenceNum}, Frame ${frameStr}`)
      } else if (!imageExists) {
        console.log(
          `Missing Image: Sentence ${sentenceNum}, Frame ${frameStr}`
        );
        // logger(`Missing Image: Sentence ${sentenceNum}, Frame ${frameStr}`);
      } else if (!objExists) {
        console.log(`Missing OBJ: Sentence ${sentenceNum}, Frame ${frameStr}`);
        // logger(`Missing OBJ: Sentence ${sentenceNum}, Frame ${frameStr}`)
      }
    }
  }
}

checkPairs();
