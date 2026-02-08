import express from 'express';



const router=express.Router()
 router.get('/test',(res,res)=>{
    console.log("helo wrl");
    
    res.send('test route')
 })
 ``
export default router;
// Protect all routes