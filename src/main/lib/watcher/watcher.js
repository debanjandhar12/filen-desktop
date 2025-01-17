const pathModule = require("path")
const log = require("electron-log")
const nodeWatch = require("node-watch")
const is = require("electron-is")

const LINUX_EVENT_EMIT_TIMER = 60000
const SUBS = {}
const linuxWatchUpdateTimeout = {}
const lastEvent = {}

const emitToWorker = (data) => {
    try{
        if(typeof require("../shared").get("WORKER_WINDOW") !== "undefined"){
            require("../shared").get("WORKER_WINDOW").webContents.send("watcher-event", data)
        }
    }
    catch(e){
        log.error(e)
    }

    return true
}

module.exports = (path, locationUUID) => {
    return new Promise((resolve) => {
        if(typeof SUBS[path] !== "undefined"){
            return resolve(SUBS[path])
        }

        try{
            SUBS[path] = nodeWatch(pathModule.normalize(path), {
                recursive: true,
                delay: 1000,
                persistent: true
            })
    
            SUBS[path].on("change", (event, name) => {
                lastEvent[path] = new Date().getTime()

                emitToWorker({ event, name, watchPath: path, locationUUID })
            })
    
            SUBS[path].on("error", (err) => log.error(err))
    
            SUBS[path].on("ready", () => {
                if(is.linux()){
                    clearInterval(linuxWatchUpdateTimeout[path])

                    linuxWatchUpdateTimeout[path] = setInterval(() => {
                        const now = new Date().getTime()

                        if(typeof lastEvent[path] !== "number"){
                            lastEvent[path] = now
                        }
                        
                        if((now - LINUX_EVENT_EMIT_TIMER) > lastEvent[path]){
                            lastEvent[path] = now

                            emitToWorker({
                                event: "dummy",
                                name: "dummy",
                                watchPath: path,
                                locationUUID
                            })
                        }
                    }, 5000)
                }

                return resolve(SUBS[path])
            })
        }
        catch(e){
            return reject(e)
        }
    })
}