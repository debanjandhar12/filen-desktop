const { app } = require("electron")
const log = require("electron-log")

let SYNC_LOCK_INTERVAL = undefined
let TRYING_TO_HOLD_SYNC_LOCK = false
let SYNC_LOCK_ACQUIRED = false
const semaphore = new require("../helpers").Semaphore(1)

app.on("before-quit", async (e) => {
    if(SYNC_LOCK_ACQUIRED){
        e.preventDefault()

        try{
            await releaseSyncLock("sync")
        }
        catch(e){
            log.error(e)
        }

        app.exit()
    }
})

const acquireSyncLock = (id = "sync") => {
    return new Promise((resolve) => {
        return resolve(true)

        semaphore.acquire().then(() => {
            if(SYNC_LOCK_ACQUIRED){
                semaphore.release()

                return resolve(true)
            }

            log.info("Acquiring sync lock")

            const acquire = async () => {
                require("../api").acquireLock({ apiKey: await require("../db").get("apiKey"), id }).then(() => {
                    log.info("Sync lock acquired")

                    SYNC_LOCK_ACQUIRED = true
                    TRYING_TO_HOLD_SYNC_LOCK = false

                    holdSyncLock(id)

                    semaphore.release()
        
                    return resolve(true)
                }).catch((err) => {
                    if(err.toString().toLowerCase().indexOf("sync locked") == -1){
                        log.error("Could not acquire sync lock from API")
                        log.error(err)
                    }

                    SYNC_LOCK_ACQUIRED = false

                    semaphore.release()
        
                    return setTimeout(acquire, 1000)
                })
            }

            return acquire()
        })
    })
}

const releaseSyncLock = (id = "sync") => {
    return new Promise((resolve, reject) => {
        return resolve(true)

        semaphore.acquire().then(async () => {
            if(!SYNC_LOCK_ACQUIRED){
                semaphore.release()

                return resolve(true)
            }
    
            log.info("Releasing sync lock")
    
            TRYING_TO_HOLD_SYNC_LOCK = false
    
            clearInterval(SYNC_LOCK_INTERVAL)
    
            require("../api").releaseLock({ apiKey: await require("../db").get("apiKey"), id }).then(() => {
                log.info("Sync lock released")
    
                SYNC_LOCK_ACQUIRED = false

                semaphore.release()
    
                return resolve(true)
            }).catch((err) => {
                log.error("Could not release sync lock from API")
                log.error(err)

                semaphore.release()
    
                return reject(err)
            })
        })
    })
}

const holdSyncLock = (id = "sync") => {
    return false
    
    clearInterval(SYNC_LOCK_INTERVAL)

    TRYING_TO_HOLD_SYNC_LOCK = false

    SYNC_LOCK_INTERVAL = setInterval(() => {
        semaphore.acquire().then(async () => {
            if(!TRYING_TO_HOLD_SYNC_LOCK && SYNC_LOCK_ACQUIRED){
                TRYING_TO_HOLD_SYNC_LOCK = true
    
                log.info("Holding sync lock")
    
                try{
                    await require("../api").holdLock({ apiKey: await require("../db").get("apiKey"), id })
                }
                catch(e){
                    log.error("Could not hold sync lock from API")
                    log.error(e)
    
                    TRYING_TO_HOLD_SYNC_LOCK = false
                    SYNC_LOCK_ACQUIRED = false
    
                    clearInterval(SYNC_LOCK_INTERVAL)

                    semaphore.release()
    
                    return false
                }
    
                TRYING_TO_HOLD_SYNC_LOCK = false
    
                log.info("Sync lock held")

                semaphore.release()
            }
            else{
                semaphore.release()
            }
        })
    }, 1000)
}

module.exports = {
    acquireSyncLock,
    holdSyncLock,
    releaseSyncLock
}