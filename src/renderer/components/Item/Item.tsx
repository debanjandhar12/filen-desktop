import React, { memo, useState, useEffect, useRef, useCallback } from "react"
import { Flex, Text, Progress, Spinner, Image } from "@chakra-ui/react"
import { bpsToReadable, timeSince } from "../../lib/helpers"
import colors from "../../styles/colors"
import { BsFileEarmark, BsFillFolderFill } from "react-icons/bs"
import { IoSearchOutline, IoArrowDown, IoArrowUp } from "react-icons/io5"
import { AiOutlinePauseCircle } from "react-icons/ai"
import ipc from "../../lib/ipc"
import memoryCache from "../../lib/memoryCache"
import { i18n } from "../../lib/i18n"

const pathModule = window.require("path")
const { shell } = window.require("electron")
const log = window.require("electron-log")

interface Props {
    task: any,
    style: any,
    userId: number,
    platform: string,
    darkMode: boolean,
    paused: boolean,
    lang: string,
    isOnline: boolean
}

/*
task.realtime !== "undefined" -> active upload/download
task.running !== "undefined" -> active move/rename/delete
task.done !== "undefined" -> done task
*/

const Item = memo(({ task, style, userId, platform, darkMode, paused, lang, isOnline }: Props) => {
    const itemName: string = useRef(pathModule.basename(task.task.path)).current
    const timeSinceInterval = useRef<any>(undefined)
    const itemAbsolutePath: string = useRef(pathModule.normalize(task.location.local + "/" + task.task.path)).current
    const itemIconCacheKey: string = useRef("fileIcon:" + itemAbsolutePath).current
    const [hovering, setHovering] = useState<boolean>(false)
    const [itemTimeSince, setItemTimeSince] = useState<string>(timeSince(typeof task.timestamp == "number" ? task.timestamp : new Date().getTime()))
    const [itemIcon, setItemIcon] = useState<any>(task.task.type == "folder" ? "folder" : (memoryCache.has(itemIconCacheKey) ? memoryCache.get(itemIconCacheKey) : undefined))

    const getFileIcon = useCallback(() => {
        if(task.task.type == "file" && typeof task.location !== "undefined" && typeof task.location.local !== "undefined"){
            if(memoryCache.has(itemIconCacheKey)){
                setItemIcon(memoryCache.get(itemIconCacheKey))
            }
            else{
                ipc.getFileIcon(itemAbsolutePath).then((icon) => {
                    if(typeof icon == "string" && icon.indexOf("data:") !== -1){
                        setItemIcon(icon)

                        memoryCache.set(itemIconCacheKey, icon)
                    }
                    else{
                        setItemIcon(null)
                    }
                }).catch(log.error)
            }
        }
    }, [task])

    const startTimeSinceInterval = useCallback(() => {
        clearInterval(timeSinceInterval.current)

        setItemTimeSince(timeSince(typeof task.timestamp == "number" ? task.timestamp : new Date().getTime()))

        timeSinceInterval.current = setInterval(() => {
            setItemTimeSince(timeSince(typeof task.timestamp == "number" ? task.timestamp : new Date().getTime()))
        }, 1000)
    }, [])

    useEffect(() => {
        startTimeSinceInterval()
        getFileIcon()

        return () => {
            clearInterval(timeSinceInterval.current)
        }
    }, [])

    return (
        <Flex
            style={style}
            width={window.innerWidth}
            justifyContent="space-between"
            alignItems="center"
            borderBottom={"0px solid " + colors(platform, darkMode, "borderPrimary")}
            paddingLeft="10px"
            paddingRight="10px"
            paddingTop="5px"
            paddingBottom="5px"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <Flex
                width={typeof task.realtime == "undefined" ? "270px" : "250px"}
                height="100%"
                justifyContent="flex-start"
                alignItems="center"
                flexDirection="row"
            >
                <Flex width="14%">
                    {
                        typeof itemIcon == "string" ? itemIcon == "folder" ? (
                            <Flex>
                                <BsFillFolderFill
                                    size={25}
                                    color={platform == "mac" ? "#3ea0d5" : "#ffd04c"}
                                />
                            </Flex>
                        ) : (
                            <Flex>
                                <Image 
                                    src={itemIcon}
                                    width="24px"
                                    height="24px" 
                                />
                            </Flex>
                        ) : itemIcon == null ? (
                            <Flex>
                                {
                                    task.task.type == "folder" ? (
                                        <BsFillFolderFill
                                            size={25}
                                            color={platform == "mac" ? "#3ea0d5" : "#ffd04c"}
                                        />
                                    ) : (
                                        <BsFileEarmark 
                                            size={25}
                                            color={colors(platform, darkMode, "textPrimary")}
                                        />
                                    )
                                }
                            </Flex>
                        ) : (
                            <Flex>
                                <Spinner
                                    width="24px"
                                    height="24px"
                                    color={colors(platform, darkMode, "textPrimary")}
                                />
                            </Flex>
                        )
                    }
                </Flex>
                <Flex
                    flexDirection="column"
                    width={typeof task.realtime == "undefined" ? "95%" : "85%"}
                >
                    <Text
                        noOfLines={1}
                        wordBreak="break-all"
                        color={colors(platform, darkMode, "textPrimary")}
                        fontSize={12}
                        fontWeight="bold"
                        maxWidth="100%"
                        width="100%"
                    >
                        {itemName}
                    </Text>
                    <Flex
                        alignItems="center"
                    >
                        {
                            typeof task.realtime !== "undefined" ? (
                                <>
                                    {
                                        task.type == "uploadToRemote" && (
                                            <IoArrowUp
                                                size={11}
                                                color={colors(platform, darkMode, "textPrimary")}
                                                style={{
                                                    marginRight: "5px",
                                                    marginTop: "3px"
                                                }}
                                            />
                                        )
                                    }
                                    {
                                        task.type == "downloadFromRemote" && (
                                            <IoArrowDown
                                                size={11}
                                                color={colors(platform, darkMode, "textPrimary")}
                                                style={{
                                                    marginRight: "5px",
                                                    marginTop: "3px"
                                                }}
                                            />
                                        )
                                    }
                                    {
                                        paused || task.task.percent <= 0 || !isOnline ? (
                                            <Progress
                                                value={0}
                                                height="5px"
                                                borderRadius="10px"
                                                colorScheme="blue"
                                                min={0}
                                                max={100}
                                                marginTop="5px"
                                                width="100%"
                                            />
                                        ) : (
                                            <Progress
                                                value={task.task.percent > 100 ? 100 : parseFloat(task.task.percent.toFixed(2))}
                                                height="5px"
                                                borderRadius="10px"
                                                colorScheme="blue"
                                                min={0}
                                                max={100}
                                                marginTop="5px"
                                                width="100%"
                                            />
                                        )
                                    }
                                </>
                            ) : (
                                <>
                                    {
                                        hovering && typeof task.task.path == "string" && typeof task.realtime == "undefined" ? (
                                            <Text
                                                noOfLines={1}
                                                wordBreak="break-all"
                                                color={colors(platform, darkMode, "textPrimary")}
                                                marginTop="1px"
                                                fontSize={11}
                                                maxWidth="100%"
                                                width="100%"
                                            >
                                                {pathModule.join(pathModule.basename(task.location.local), task.task.path)}
                                            </Text>
                                        ) : (
                                            <Text
                                                noOfLines={1}
                                                wordBreak="break-all"
                                                color={colors(platform, darkMode, "textPrimary")}
                                                marginTop="1px"
                                                fontSize={11}
                                                maxWidth="100%"
                                                width="100%"
                                            >
                                                {
                                                    task.type == "downloadFromRemote" && i18n(lang, "syncTaskDownloadFromRemote")
                                                }
                                                {
                                                    task.type == "uploadToRemote" && i18n(lang, "syncTaskUploadToRemote")
                                                }
                                                {
                                                    task.type == "renameInRemote" && i18n(lang, "syncTaskRenameInRemote")
                                                }
                                                {
                                                    task.type == "renameInLocal" && i18n(lang, "syncTaskRenameInLocal")
                                                }
                                                {
                                                    task.type == "moveInRemote" && i18n(lang, "syncTaskMoveInRemote")
                                                }
                                                {
                                                    task.type == "moveInLocal" && i18n(lang, "syncTaskMoveInLocal")
                                                }
                                                {
                                                    task.type == "deleteInRemote" && i18n(lang, "syncTaskDeleteInRemote")
                                                }
                                                {
                                                    task.type == "deleteInLocal" && i18n(lang, "syncTaskDeleteInLocal")
                                                }
                                                &nbsp;
                                                &#8226;
                                                &nbsp;
                                                {itemTimeSince}
                                            </Text>
                                        )
                                    }
                                </>
                            )
                        }
                    </Flex>
                </Flex>
            </Flex>
            <Flex
                width={typeof task.realtime == "undefined" ? "65px" : "65px"}
                justifyContent="flex-end" 
                flexDirection="row"
            >
                <Flex 
                    flexDirection="column" 
                    justifyContent="center"
                >
                    {
                        typeof task.realtime !== "undefined" || typeof task.running !== "undefined" ? (
                            <Flex 
                                alignItems="center"
                                justifyContent="flex-end" 
                                flexDirection="row"
                            >
                                {
                                    typeof task.realtime !== "undefined" ? (
                                        <>
                                            {
                                                (paused || !isOnline) ? (
                                                    <AiOutlinePauseCircle
                                                        color={colors(platform, darkMode, "textPrimary")}
                                                        fontSize={18} 
                                                    />
                                                ) : (
                                                    task.task.percent <= 0 ? (
                                                        <Text 
                                                            noOfLines={1}
                                                            color={colors(platform, darkMode, "textPrimary")}
                                                            fontSize={12}
                                                            wordBreak="break-all"
                                                        >
                                                            {i18n(lang, "queued")}
                                                        </Text>
                                                    ) : task.task.percent >= 99 ? (
                                                        <Spinner 
                                                            width="16px"
                                                            height="16px"
                                                            color={colors(platform, darkMode, "textPrimary")}
                                                        />
                                                    ) : (
                                                        <Text 
                                                            noOfLines={1}
                                                            color={colors(platform, darkMode, "textPrimary")}
                                                            fontSize={12}
                                                            wordBreak="break-all"
                                                        >
                                                            {bpsToReadable(task.task.lastBps)}
                                                        </Text>
                                                    )
                                                )
                                            }
                                        </>
                                    ) : (
                                        <Spinner 
                                            width="16px"
                                            height="16px"
                                            color={colors(platform, darkMode, "textPrimary")}
                                        />
                                    )
                                }
                            </Flex>
                        ) : (
                            <>
                                {
                                    hovering && ["renameInLocal", "downloadFromRemote", "moveInLocal", "uploadToRemote", "renameInRemote", "moveInRemote"].includes(task.type) ? (
                                        <Flex 
                                            alignItems="center" 
                                            justifyContent="flex-end" 
                                            flexDirection="row"
                                        >
                                            <IoSearchOutline 
                                                size={18} 
                                                color={colors(platform, darkMode, "textPrimary")} 
                                                cursor="pointer" 
                                                onClick={() => {
                                                    try{
                                                        shell.showItemInFolder(pathModule.normalize(task.location.local + "/" + task.task.path))
                                                    }
                                                    catch(e){
                                                        log.error(e)
                                                    }
                                                }} 
                                            />
                                        </Flex>
                                    ) : (
                                        <></>
                                    )
                                }
                            </>
                        )
                    }
                </Flex>
            </Flex>
        </Flex>
    )
})

export default Item