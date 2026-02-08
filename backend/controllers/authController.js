import bcrypt from 'bcrypt';

import { get } from '../mongoDb/mongoConfig.js';
import { ObjectId } from 'mongodb';
import { collection } from '../mongoDb/collection.js';
import validator from 'validator';
import { createUser, findUserByEmail } from '../mongoLogic/authLogic.js';
import { User } from '../mongoDb/mongoStructure.js'
import { generateTokeandCookie } from './util/generateTokeandCookie.js';
import { sendVerificationEmail, sendWelcomeEmail, sendUserResetEmail, sendResetEmailSucess } from '../mailtrap/emai.js';
// Import the library
import { date, string, success, z, ZodError } from 'zod';

import isEmail from 'validator/lib/isEmail.js';
import crypto from "crypto";
// Create a schema to define your data structure

export const verifyEmail = async (req, res) => {
  const { code } = req.body;

  try {
    // 1. Basic validation
    if (!code || isNaN(code)) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required and must be a number",
      });
    }

    const db = get();

    // 2. Atomic find + update + return (no password fetched)
    const result = await db.collection(collection.User).findOneAndUpdate(
      {
        verificationToken: parseInt(code),
        verificationTokenExpiresAt: { $gt: new Date() }
      },
      {
        $set: {
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiresAt: null
        }
      },
      {
        returnDocument: 'after', // return the updated document
        projection: {
          password: 0, resetPasswordToken: 0,
          resetPasswordToken: 0,
          resetPasswordExpiresAt: 0, // exclude reset password fields
          resetPasswordExpiresAt: 0,
          verificationToken: 0,
          verificationTokenExpiresAt: 0
        } // exclude password entirely
      }
    );
    console.log({ result });



    // 3. Check if user was found
    if (!result) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }


 

    // 4. Send response
    await sendWelcomeEmail(result.email,result.name)
    return res.status(200).json({
      success: true,
      message: "Email successfully verified",
      user: result
    });

  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
console.log("reached login");

    // Basic input check
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // Email format validation
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const db = get()
    // Update last login
    await db.collection(collection.User).updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    console.log("✅ Login successful for:", email);
    res.status(200).json({ message: "Login successful." ,user: user });

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
}
export const signup = async (req, res) => {
  try {
    console.log("reached signup");

    console.log(req.body);
    const signupSchema = z.object({
      name: z.string().min(2, { message: "Name must be at least 2 characters long" }),
      email: z.string().email({ message: "Invalid email format" }),
      password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
    });

    const { name, email, password } = signupSchema.parse(req.body);




    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationToken = Math.floor(100000 + Math.random() * 900000);

    const now = new Date();
    const document = {
      ...User(),
      name,
      email,
      password: hashedPassword,

      verificationToken,


    };


    // Insert document into MongoDB

    const safeUser = (() => {
      const { isVerified, verificationTokenExpiresAt, password, verificationToken, lastLogin, resetPasswordExpiresAt, resetPasswordToken, ...rest } = document;
      return rest;
    });
    const result = await createUser(document);


    if (result?.insertedId) {
      generateTokeandCookie(res, result.insertedId);

     await sendVerificationEmail(email,verificationToken)
      //  await sendVerificationEmail(document.email,verificationToken)
      console.log("✅ User created with ID:", result.insertedId);
      res.status(201).json({ sucess: true, message: "User created successfully.", user: safeUser() });
    } else {
      return res.status(500).json({ message: "Failed to create user." });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Check Your Email or Password',

      });
    } else {
      if (error.message === "EMAIL_EXISTS") {
        return res.status(400).json({ message: "Email already registered." });
      }
      // some other unexpected error
      console.error("❌ Signup Error:", error);

      return res.status(500).json({ message: 'Internal server error' });
    }
  }


}
export const logout = async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({
    succes: "true",
    message: "Log out successfull"
  })

}
export const forgotPassword = async (req, res) => {
  const { email } = req.body;


  if (!isEmail(email)) {
    return res.status(400).json({ message: "Invalid email address." });
  }

  try {
    const db = get();
    const user = await db.collection(collection.User).findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User Not Found" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordTokenTime = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

    await db.collection(collection.User).updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpiresAt: resetPasswordTokenTime,
        },
      }
    );

    await sendUserResetEmail(
      user.email,
      `${process.env.CLIENT_URL}/reset-password/${resetToken}`
    );


    return res.status(200).json({
      message: "Reset password link sent to your email",
      success: true,
    });

  } catch (error) {
    console.error("Reset Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
 

    // Proper validation
    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token and password are required." });
    }

    const db = get();

    // 1. Find user with valid token and expiration date
    const user = await db.collection(collection.User).findOne({
      resetPasswordToken: String(token),
      resetPasswordExpiresAt: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link." });
    }

    // 2. Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Update user's password and clear reset token fields
    await db.collection(collection.User).updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: "", resetPasswordExpiresAt: "" }
      }
    );

    // 4. Notify user via email
    // await sendResetEmailSucess(user.email);

    return res.status(200).json({ success: true, message: "Password has been reset successfully." });

  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
export const checkAuth = async (req, res) => {
  try {
    const db = get();
    const user = await db.collection(collection.User).findOne(
      { _id: new ObjectId(req.userId) },
      {
        projection: {
          password: 0,
          resetPasswordToken: 0,
          resetPasswordExpiresAt: 0,
          verificationToken: 0,
          verificationTokenExpiresAt: 0
        }
      }
    );

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("❌ Auth error:", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



