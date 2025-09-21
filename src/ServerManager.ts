import { v4 as uuidv4 } from 'uuid';

export class ServerManager{
    private static instance: ServerManager;
    private static serverId: string;
    private constructor(){
        ServerManager.serverId = uuidv4();
    }
    static getInstance():ServerManager{
        if(!this.instance){
            this.instance = new ServerManager();
        }
        return this.instance;
    }
    getServerid():string{
        return ServerManager.serverId;
    }
}