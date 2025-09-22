import express, { json } from "express";
import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { RedisManager } from "./RedisManager";
import { ServerManager } from "./ServerManager";

type MessageType =
  | { type: "Auth"; token: string }
  | { type: "Direct"; fromId: string; toId: string; text: string }
  | {type :"Group";fromId:string,groupId:string,text:string;members:string[]}

interface JwtPayload {
  userid: string;
  iat?: number;
  exp?: number;
}

const serverInstance = ServerManager.getInstance();
const serverId = serverInstance.getServerid();

// Use the same secret as in NextAuth
const JWT_SECRET = process.env.JWT_SECRET || "harish2004";

const PORT = process.env.PORT || 8080;
const app = express();

app.get("/hi",(req,res)=>{
  res.json({
    msg:'hi'
  })
})
const httpServer = app.listen(PORT, () => {
  console.log(`listen on ${PORT}`);
});
const wss = new WebSocketServer({ server: httpServer });

const userSocketMap = new Map<string, WebSocket>();

(async () => {
  await RedisManager.getInstance();

  // Listen for routed messages from other servers
  RedisManager.redisSub.subscribe(`route_${serverId}`, (message: string) => {
    try {
      const data = JSON.parse(message);
      const recipient = userSocketMap.get(data.toId);
      if (recipient) {
        if(data.type === "Group"){
          console.log("group reached after redis");
          recipient.send(JSON.stringify({type:"Group",groupId:data.groupId,fromId: data.fromId, text: data.text}))
        }
        else if(data.type === "Direct"){
          recipient.send(JSON.stringify({ type:"Direct",fromId: data.fromId, text: data.text }));
        }
      }
    } catch (err) {
      console.error("Error handling routed message:", err);
    }
  });
})();

wss.on("connection", (socket) => {
  socket.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  socket.on("close", async () => {
    for (const [id, ws] of userSocketMap.entries()) {
      if (ws === socket) {
        userSocketMap.delete(id);
        await RedisManager.client.hDel("UserServerMap", id);
        console.log(`${id} disconnected`);
        break;
      }
    }
  });

  socket.on("message", async (rawData) => {
    try {
      const message: MessageType = JSON.parse(rawData.toString());

      if (message.type === "Auth") {
        try {
          
          
          const decoded = jwt.verify(message.token, JWT_SECRET) as JwtPayload;
          console.log("Successfully decoded token:", { userid: decoded.userid });

          if (!decoded || !decoded.userid) {
            throw new Error(`Invalid token payload. Missing id. Decoded: ${JSON.stringify(decoded)}`);
          }

          await RedisManager.client.hSet("UserServerMap", decoded.userid, serverId);
          userSocketMap.set(decoded.userid, socket);

          console.log(`${decoded.userid} connected to ${serverId}`);


          socket.send(JSON.stringify({ 
            type: "AuthSuccess", 
            message: `${decoded.userid} connected to ${serverId}` 


          }));

        } 
        catch (err) {
          console.error("Authentication failed:", err);
          socket.send(JSON.stringify({ 
            type: "AuthError", 
            message: "Authentication failed" 
          }));
          socket.close();
        }

      } 
      else if(message.type == 'Group'){
        const senderId = message.fromId;
        console.log("inside group if");
        try{
            await Promise.all(message.members.map(async (toId)=>{
               const serverId = await RedisManager.client.hGet("UserServerMap",toId);
               if(serverId){
                 await RedisManager.redisPub.publish(
                  `route_${serverId}`,
                  JSON.stringify({ type: "Group", groupId: message.groupId, toId, fromId: message.fromId, text: message.text })
                 )
               }
            }))
        }
        catch(err){
          console.log(err);
        }
      }
      else if (message.type === "Direct") {
        try {
          console.log("direct message received");
          const localRecipientSocket = userSocketMap.get(message.toId);

          if (localRecipientSocket) {
            localRecipientSocket.send(JSON.stringify({
              type:"Direct", 
              fromId: message.fromId, 
              text: message.text 
            }));
            return;
          }

          const recipientServer = await RedisManager.client.hGet("UserServerMap", message.toId);
          if (recipientServer) {
            await RedisManager.redisPub.publish(
              `route_${recipientServer}`,
              JSON.stringify({ 
                type:message.type,
                fromId: message.fromId, 
                toId: message.toId, 
                text: message.text 
              })
            );
          }
        } catch (err) {
          console.error("Direct message error:", err);
        }
      }
    } catch (parseError) {
      console.error("Error parsing message:", parseError);
    }
  });
});