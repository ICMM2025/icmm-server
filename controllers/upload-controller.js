const prisma = require("../models/index");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const cloudinary = require("../utils/cloudinary");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs/promises");
const { parse, isValid } = require("date-fns");

const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);

module.exports.upload = tryCatch(async (req, res, next) => {
  const { name, email } = req.body;
  const imageFile = req.files?.[0];

  if (!imageFile) {
    createError(400, "No image uploaded");
  }

  const user = await prisma.user.findFirst({
    where: { userName: name, email },
  });
  if (!user) {
    createError(400, "User not found");
  }
  // 1. Upload to Cloudinary
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  const uniqueId = `virtual_run/${user.userId}_${timestamp}`;
  let cloud;
  try {
    cloud = await cloudinary.uploader.upload(imageFile.path, {
      overwrite: true,
      folder: "icmm/virtual_run",
      public_id: uniqueId,
      width: 1000,
      height: 1000,
      crop: "limit",
    });
  } catch (err) {
    return next(createError(500, "errFailToUploadEvidence"));
  }
  // 2. Analyze with Gemini
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const base64 = (await fs.readFile(imageFile.path)).toString("base64");
  const result = await model.generateContent([
    {
      inlineData: { mimeType: "image/jpeg", data: base64 },
    },
    {
      text: `Extract running date, distance (km), and total time (HH:MM:SS) from this running result. Return JSON like:
{
  "date": "2025-06-08",
  "distance": "21.28km",
  "totalTime": "2:29:03"
}`,
    },
  ]);
  // 3. Parse and clean up
  await fs.unlink(imageFile.path);

  const content = result.response.candidates[0]?.content?.parts[0]?.text || "";

  // Extract JSON object substring from the content string
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  let analysis = {};
  if (!jsonMatch) {
    console.warn("No JSON object found in AI response");
  } else {
    const jsonString = jsonMatch[0];
    try {
      analysis = JSON.parse(jsonString);
    } catch (err) {
      console.warn("Failed to parse JSON:", err);
    }
  }

  const distance = analysis.distance
    ? parseFloat(analysis.distance.replace("km", ""))
    : null;
  const date =
    analysis.date && !isNaN(Date.parse(analysis.date))
      ? new Date(analysis.date)
      : null;
  const totalTime = analysis.totalTime || null;

  // 4. Insert into DB
  await prisma.virtualRun.create({
    data: {
      userId: user.userId,
      userUploadPicUrl: cloud.secure_url,
      aiDate: isValid(date) ? date : null,
      aiDistance: isNaN(distance) ? null : distance,
      aiTotalTime: analysis.totalTime || null,
      confirmedDate: isValid(date) ? date : null,
      confirmedDistance: isNaN(distance) ? null : distance,
      confirmedTime: analysis.totalTime || null,
      status: "uploaded",
    },
  });

  res.json({ msg: "upload successful...." });
});

module.exports.getVirtualTrans = tryCatch(async (req, res, next) => {
  const trans = await prisma.virtualRun.findMany();
  res.json({ trans, msg: "get virtual trans successful...." });
});
