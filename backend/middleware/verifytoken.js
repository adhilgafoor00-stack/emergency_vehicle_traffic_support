import jwt from "jsonwebtoken";


export const verifyToken=(req,res,next)=>{
    const token=req.cookies.token
    if(!token) return res.status(401).json({message:"Unauthorised",success:false})
    try {
        const decoded=jwt.verify(token,process.env.jwt_secret)
       if (!decoded) return res.status(401).json({ message: "Invalid Token", success: false });

        req.userId=decoded.userId
        next()
    } catch (error) {
           console.error("Error in verifying token:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
    }
} 