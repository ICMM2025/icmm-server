const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyDtD-paa-qY-oyc1x9WFAUnphfQirhNuVc");

async function analyzeRunImage(imagePath) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const imageBytes = fs.readFileSync(imagePath).toString("base64");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBytes,
            },
          },
          {
            text: `Extract the following from the image if possible:
Return a JSON like:
{
  date: "YYYY-MM-DD",
  distance: "in km",
  TotalTime: "HH:MM:SS"
}
If any field is missing or unclear, leave it null.`,
          },
        ],
      },
    ],
  });

  const response = await result.response;
  const text = response.text();
  console.log("Extracted JSON:", text);
}

analyzeRunImage("scripts/photo/IMG_1481.PNG");
