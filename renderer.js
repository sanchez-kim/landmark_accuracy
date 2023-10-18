import * as THREE from "three";
import { OBJLoader } from "OBJLoader";

const scene = new THREE.Scene();
const aspectRatio = canvas2.width / canvas2.height;
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("canvas2"),
});
renderer.setSize(canvas2.width, canvas2.height);
renderer.setClearColor(0xffffff);
document.querySelector(".webglContainer").appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
camera.position.z = 2;
camera.fov = 36;
camera.updateProjectionMatrix();

const light = new THREE.DirectionalLight(0xffffff, 2.0);
light.position.set(1, 1, 1).normalize();
scene.add(light);

window.addEventListener("resize", function () {
  const newAspectRatio = canvas2.width / canvas2.height;
  camera.aspect = newAspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas2.width, canvas2.height);
});

const loader = new OBJLoader();

let landmarks1, landmarks2;
let processingImage1 = true;
let storedImage1 = null;

const canvasElement1 = document.getElementById("canvas1");
const canvasCtx1 = canvasElement1.getContext("2d");

function onResults(results) {
  const canvasElement2 = document.getElementById("canvas2");
  const canvasCtx2 = canvasElement2.getContext("2d");
  console.log(processingImage1);
  let canvasCtx = processingImage1 ? canvasCtx1 : canvasCtx2;
  let canvasElement = processingImage1 ? canvasElement1 : canvasElement2;
  console.log("onResults result: ", results);
  console.log("canvasCtx: ", canvasCtx);
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results && results.image) {
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );
  } else {
    console.error("results.image is not defined", results);
  }

  if (
    results &&
    results.multiFaceLandmarks &&
    results.multiFaceLandmarks.length > 0
  ) {
    if (processingImage1) {
      landmarks1 = results.multiFaceLandmarks[0];
    } else {
      landmarks2 = results.multiFaceLandmarks[0];
    }
    for (const landmarks of results.multiFaceLandmarks) {
      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {
        color: "#FF3030",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {
        color: "#FF3030",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, {
        color: "#FF3030",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {
        color: "#30FF30",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {
        color: "#30FF30",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, {
        color: "#30FF30",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {
        color: "#E0E0E0",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: "#E0E0E0" });
    }
  }
  canvasCtx.restore();
}

function processImage(file, canvasCtx, canvasElement, callback) {
  const image = new Image();
  image.src = URL.createObjectURL(file);

  image.onload = function () {
    try {
      canvasCtx.drawImage(
        image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
      storedImage1 = canvasCtx.getImageData(
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      faceMesh.send({ image: canvasElement }).then(callback);
    } catch (error) {
      console.error("Error from faceMesh.send: ", error);
    }
  };
}

// function renderFrontalImage() {
//   renderer.render(scene, camera);

//   // Create an offscreen canvas
//   const offscreenCanvas = document.createElement("canvas");
//   offscreenCanvas.width = renderer.domElement.width;
//   offscreenCanvas.height = renderer.domElement.height;
//   const offscreenCtx = offscreenCanvas.getContext("2d");

//   // Draw the renderer's domElement onto the offscreen canvas
//   offscreenCtx.drawImage(renderer.domElement, 0, 0);

//   faceMesh.send({ image: offscreenCanvas }).then((results) => {
//     onResults(results, true, canvasCtx2, canvasElement2);
//     compareLandmarks();
//   });
// }

function canvasToImage(canvas) {
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  return image;
}

function renderFrontalImage() {
  renderer.render(scene, camera);

  const image = canvasToImage(renderer.domElement);
  image.onload = function () {
    faceMesh.send({ image: image }).then((landmarks) => {
      landmarks2 = landmarks;
      compareLandmarks();
    });
  };
}

function compareLandmarks() {
  let total = 0;
  let num_landmarks;
  let detailedMessage = "";

  if (!landmarks1 || !landmarks2) {
    return;
  }

  if (landmarks1 && landmarks2) {
    num_landmarks = landmarks1.length;
    // Calculate distances between corresponding landmarks.
    for (let i = 0; i < landmarks1.length; i++) {
      const distance = Math.sqrt(
        Math.pow(landmarks2[i].x - landmarks1[i].x, 2) +
          Math.pow(landmarks2[i].y - landmarks1[i].y, 2)
      );
      total += distance;
      detailedMessage += `Distance for landmark ${i}: ${distance.toFixed(2)}\n`;
    }
    const average = total / num_landmarks;
    const message = `
    Number of Landmarks: ${num_landmarks}
    Average Distance: ${average.toFixed(2)}
    `;
    document.querySelector(".result").innerText = message;
    document.getElementById("detailed_results").innerText = detailedMessage;
  }
}

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  },
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
faceMesh.onResults(onResults);

document.getElementById("imageInput1").addEventListener("change", function () {
  processingImage1 = true;
  processImage(this.files[0], canvasCtx1, canvasElement1, () => {
    // onResults(results, false, canvasCtx1, canvasElement1);
    compareLandmarks();
  });
});

document.getElementById("imageInput2").addEventListener("change", function () {
  processingImage1 = false;
  const file = this.files[0];
  const reader = new FileReader();

  reader.onload = function (event) {
    loader.load(event.target.result, function (object) {
      scene.add(object);
      renderFrontalImage();
    });
  };
  reader.readAsDataURL(file);
});

// document.querySelector(".collapsible").addEventListener("click", function () {
//   this.classList.toggle("active");
//   let content = this.nextElementSibling;
//   if (content.style.maxHeight) {
//     content.style.maxHeight = null;
//   } else {
//     content.style.maxHeight = content.scrollHeight + "px";
//   }
// });
