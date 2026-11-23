"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { parentPort, workerData } = require("node:worker_threads");
const sharp = require("sharp");
const tf = require("@tensorflow/tfjs");
const wasm = require("@tensorflow/tfjs-backend-wasm");
const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js");

function wasmDirectory() {
  let directory = path.dirname(require.resolve("@tensorflow/tfjs-backend-wasm"));
  directory = directory.replace(/\.asar([\\/])/, ".asar.unpacked$1");
  return directory;
}

async function initialize() {
  const directory = wasmDirectory();
  const wasmNames = [
    "tfjs-backend-wasm.wasm",
    "tfjs-backend-wasm-simd.wasm",
    "tfjs-backend-wasm-threaded-simd.wasm",
  ];
  const wasmPaths = Object.fromEntries(
    wasmNames.map((name) => [name, pathToFileURL(path.join(directory, name)).href]),
  );
  const platform = tf.env().platform;
  const platformFetch = platform.fetch.bind(platform);
  platform.fetch = (url, options) => {
    const address = String(url);
    if (address.startsWith("file://")) {
      return fs.readFile(fileURLToPath(address)).then((buffer) => new Response(buffer));
    }
    return platformFetch(url, options);
  };
  wasm.setWasmPaths(wasmPaths, true);
  await tf.setBackend("wasm");
  await tf.ready();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(workerData.modelDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(workerData.modelDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(workerData.modelDir);
}

async function describe(buffer) {
  const image = await sharp(Buffer.from(buffer), { failOn: "none", limitInputPixels: 500_000_000 })
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(image.data, [image.info.height, image.info.width, 3], "int32");
  try {
    const faces = await faceapi
      .detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 20 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    return faces.slice(0, 20).map((face) => Array.from(face.descriptor));
  } finally {
    tensor.dispose();
  }
}

initialize()
  .then(() => parentPort.postMessage({ type: "ready" }))
  .catch((error) => parentPort.postMessage({ type: "init-error", error: error.message }));

parentPort.on("message", async (message) => {
  if (message.type !== "describe") return;
  try {
    const faces = await describe(message.buffer);
    parentPort.postMessage({ type: "result", id: message.id, faces });
  } catch (error) {
    parentPort.postMessage({ type: "result", id: message.id, error: error.message });
  }
});
