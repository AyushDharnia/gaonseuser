import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModel.js";
import { Subscription } from "../models/subscriptionModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

//
// ================= REGISTER =================
//
export const register = catchAsyncError(async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      verificationMethod,
      city,
    } = req.body;

    // ✅ VALIDATION
    if (!name || !email || !phone || !password || !verificationMethod || !city) {
      return next(new ErrorHandler("All fields are required.", 400));
    }

    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return next(new ErrorHandler("Invalid phone number.", 400));
    }
      
    const existingUser = await User.findOne({
      $or: [
        { email, accountVerified: true },
        { phone, accountVerified: true },
      ],
    });

    if (existingUser) {
      return next(new ErrorHandler("Phone or Email is already used.", 400));
    }

    const attempts = await User.find({
      $or: [
        { phone, accountVerified: false },
        { email, accountVerified: false },
      ],
    });

    if (attempts.length > 120) {
      return next(
        new ErrorHandler(
          "Too many attempts. Try again after some time.",
          400
        )
      );
    }

    // Delete any previous unverified attempts with the same email or phone to prevent duplicates
    await User.deleteMany({
      accountVerified: false,
      $or: [
        { email },
        { phone },
      ],
    });

    // ✅ CREATE USER WITH CITY
    const user = await User.create({
      name,
      email,
      phone,
      password,
      city,
    });

    const verificationCode = user.generateVerificationCode();
    await user.save();

    sendVerificationCode(
      verificationMethod,
      verificationCode,
      name,
      email,
      phone,
      res
    );
  } catch (error) {
    next(error);
  }
});

//
// ================= SEND OTP =================
//
async function sendVerificationCode(
  method,
  code,
  name,
  email,
  phone,
  res
) {
  try {
    // EMAIL VERIFICATION
    if (method === "email") {
      const message = generateEmailTemplate(code);

      await sendEmail({
        email,
        subject: "Verification Code",
        message,
      });

      return res.status(200).json({
        success: true,
        message: `Verification email sent to ${name}`,
      });
    }

    // PHONE VERIFICATION
    if (method === "phone") {

      // Validate phone number
      if (!phone.startsWith("+")) {
        return res.status(400).json({
          success: false,
          message: "Phone number must include country code",
        });
      }

      const spacedCode = code.toString().split("").join(" ");

      const call = await client.calls.create({
        twiml: `<Response><Say>Your verification code is ${spacedCode}</Say></Response>`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });

      return res.status(200).json({
        success: true,
        message: "OTP sent on phone",
      });
    }

    // INVALID METHOD
    return res.status(400).json({
      success: false,
      message: "Invalid verification method",
    });

  } catch (error) {

    console.error("SEND OTP ERROR:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
}
//
// ================= VERIFY OTP =================
//
export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp, phone } = req.body;

  const phoneRegex = /^\+91[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return next(new ErrorHandler("Invalid phone number.", 400));
  }

  const users = await User.find({
    $or: [
      { email, accountVerified: false },
      { phone, accountVerified: false },
    ],
  }).sort({ createdAt: -1 });

  if (!users.length) {
    return next(new ErrorHandler("User not found.", 404));
  }

  let user = users[0];

  if (users.length > 1) {
    await User.deleteMany({
      _id: { $ne: user._id },
      $or: [
        { email, accountVerified: false },
        { phone, accountVerified: false },
      ],
    });
  }

  if (user.verificationCode !== Number(otp)) {
    return next(new ErrorHandler("Invalid OTP.", 400));
  }

  if (Date.now() > new Date(user.verificationCodeExpire).getTime()) {
    return next(new ErrorHandler("OTP Expired.", 400));
  }

  user.accountVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpire = null;

  await user.save();

  sendToken(user, 200, "Account verified", res);
});

//
// ================= LOGIN =================
//
export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Email & password required", 400));
  }

  const user = await User.findOne({
    email,
    accountVerified: true,
  }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid credentials", 400));
  }

  const match = await user.comparePassword(password);

  if (!match) {
    return next(new ErrorHandler("Invalid credentials", 400));
  }

  sendToken(user, 200, "Login successful", res);
});

//
// ================= LOGOUT =================
//
export const logout = catchAsyncError(async (req, res) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out",
    });
});

//
// ================= GET USER =================
//
export const getUser = catchAsyncError(async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

//
// ================= FORGOT PASSWORD =================
//
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const otp = user.generateVerificationCode();
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user.email,
    subject: "GAON SE - Reset Password OTP",
    message: `
      <h2>Reset Password OTP</h2>
      <p>Your OTP to reset your GAON SE account password is: <b>${otp}</b></p>
      <p>This OTP is valid for 10 minutes.</p>
    `,
  });

  res.json({
    success: true,
    message: "OTP sent to your email",
  });
});

//
// ================= RESET PASSWORD =================
//
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { email, otp, password, confirmPassword } = req.body;

  if (!email || !otp || !password || !confirmPassword) {
    return next(new ErrorHandler("All fields are required.", 400));
  }

  const user = await User.findOne({
    email,
    accountVerified: true,
  }).select("+password");

  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  if (!user.verificationCode || user.verificationCode !== Number(otp)) {
    return next(new ErrorHandler("Invalid OTP.", 400));
  }

  if (Date.now() > new Date(user.verificationCodeExpire).getTime()) {
    return next(new ErrorHandler("OTP Expired.", 400));
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Passwords do not match.", 400));
  }

  user.password = password;
  user.verificationCode = null;
  user.verificationCodeExpire = null;

  await user.save();

  sendToken(user, 200, "Password reset successful.", res);
});

//
// ================= EMAIL TEMPLATE =================
//
function generateEmailTemplate(code) {
  return `
    <h2>Verification Code</h2>
    <p>Your code is: <b>${code}</b></p>
  `;
}

//
// ================= UPDATE CITY & DELETE SUBSCRIPTIONS =================
//
export const updateCity = catchAsyncError(async (req, res, next) => {
  const { city } = req.body;

  if (!city) {
    return next(new ErrorHandler("City is required.", 400));
  }

  // 1. Update user city
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  user.city = city;
  await user.save();

  // 2. Soft-delete ongoing subscriptions
  await Subscription.updateMany(
    { user: req.user._id, isDeleted: false },
    { $set: { isDeleted: true } }
  );

  // Populate city again for response
  const updatedUser = await User.findById(req.user._id).populate("city");

  res.status(200).json({
    success: true,
    message: "City updated and ongoing subscriptions deleted successfully.",
    user: updatedUser,
  });
});

//
// ================= UPDATE EMAIL/PHONE REQUEST (OTP) =================
//
export const updateRequest = catchAsyncError(async (req, res, next) => {
  const { type, value } = req.body;

  if (!type || !value) {
    return next(new ErrorHandler("Type and value are required.", 400));
  }

  if (type !== "email" && type !== "phone") {
    return next(new ErrorHandler("Invalid type. Must be 'email' or 'phone'.", 400));
  }

  // Check uniqueness among verified users
  if (type === "email") {
    const existingUser = await User.findOne({ email: value, accountVerified: true });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return next(new ErrorHandler("Email is already in use.", 400));
    }
  } else {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return next(new ErrorHandler("Invalid phone number. Must start with +91 followed by 10 digits.", 400));
    }
    const existingUser = await User.findOne({ phone: value, accountVerified: true });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return next(new ErrorHandler("Phone number is already in use.", 400));
    }
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  // Generate 5-digit verification code
  const firstDigit = Math.floor(Math.random() * 9) + 1;
  const remainingDigits = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  const code = parseInt(firstDigit + remainingDigits);

  user.tempOTP = code;
  user.tempOTPExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  if (type === "email") {
    user.tempEmail = value;
    user.tempPhone = undefined;

    // Send code via email
    await sendEmail({
      email: value,
      subject: "GAON SE - Profile Verification Code",
      message: `
        <h2>Email Update Verification</h2>
        <p>Your OTP to verify your new email address is: <b>${code}</b></p>
        <p>This code is valid for 10 minutes.</p>
      `,
    });
  } else {
    user.tempPhone = value;
    user.tempEmail = undefined;

    // Send code via twilio phone call
    const spacedCode = code.toString().split("").join(" ");
    await client.calls.create({
      twiml: `<Response><Say>Your verification code is ${spacedCode}</Say></Response>`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: value,
    });
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: `Verification code sent to your new ${type}.`,
  });
});

//
// ================= UPDATE EMAIL/PHONE VERIFY =================
//
export const updateVerify = catchAsyncError(async (req, res, next) => {
  const { type, otp } = req.body;

  if (!type || !otp) {
    return next(new ErrorHandler("Type and OTP are required.", 400));
  }

  if (type !== "email" && type !== "phone") {
    return next(new ErrorHandler("Invalid type. Must be 'email' or 'phone'.", 400));
  }

  const user = await User.findById(req.user._id).populate("city");
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  if (!user.tempOTP || user.tempOTP !== Number(otp)) {
    return next(new ErrorHandler("Invalid OTP.", 400));
  }

  if (Date.now() > new Date(user.tempOTPExpire).getTime()) {
    return next(new ErrorHandler("OTP Expired.", 400));
  }

  if (type === "email") {
    if (!user.tempEmail) {
      return next(new ErrorHandler("No pending email update found.", 400));
    }
    user.email = user.tempEmail;
  } else {
    if (!user.tempPhone) {
      return next(new ErrorHandler("No pending phone update found.", 400));
    }
    user.phone = user.tempPhone;
  }

  user.tempEmail = undefined;
  user.tempPhone = undefined;
  user.tempOTP = undefined;
  user.tempOTPExpire = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: `${type === "email" ? "Email" : "Phone number"} updated successfully.`,
    user,
  });
});