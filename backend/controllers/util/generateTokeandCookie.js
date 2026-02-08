 import jwt from 'jsonwebtoken';

 
  export const generateTokeandCookie = (res,userId) => {
      const token=jwt.sign({userId},process.env.jwt_secret,{expiresIn:'3d'})
      res.cookie("token",token,{
          httpOnly:true, // Prevents client-side JavaScript from accessing the cookie and xss
          secure:process.env.NODE_ENV === 'production',
          sameSite:'strict',
  maxAge:7*24*60*60*1000 // 3 days in milliseconds

      })
      return token;
  }
  