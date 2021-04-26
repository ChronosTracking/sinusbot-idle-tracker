registerPlugin({
    name: 'sinusbot-idle-tracker',
    version: '1.0',
    description: 'Tracks the idle time of a user and activates a kick timer after a set treshold',
    author: 'Erik Spiegel',
    vars: [

        {
            name: 'idleTime',
            title: 'Max idle time (in minutes)',
            type: 'number',
            placeholder: '5',
            default: 5
        },
        {
            name: 'jan_uid',
            title: 'UID',
            type: 'string',
            placeholder: ''
        },
        {
            name: 'banTime',
            title: 'Ban length (in minutes)',
            type: 'number',
            placeholder: '30',
            default: 30
        },
        {
            name: 'idleChannelList',
            title: 'Idle Channel',
            type: 'array',
            vars: [
                {
                    name: 'idleChannel',
                    Title: 'Channel',
                    indent: 1,
                    type: 'channel'
                }
            ]
        },
        {
            name: 'debugMode',
            title: 'Debug mode',
            type: 'checkbox'
        }
    ]
}, function(sinusbot, config, meta) {

    const event = require('event')
    const backend = require('backend')
    const engine = require('engine')

    const maxIdleTime = config.idleTime * 60 * 1000
    const UID = config.jan_uid
    const banTime = config.banTime * 60
    const idleChannelList = config.idleChannelList.filter(el => el.idleChannel != undefined).map(el => el.idleChannel)
    const debugMode = config.debugMode

    console.log('Max idle time in minutes : ' + maxIdleTime / 60000)
    console.log('UID of user: ' + UID)
    console.log('Ban time in minutes: ' + banTime / 60)
    console.log('List of idle channels: ' + [... new Set(idleChannelList.map(el => backend.getChannelByID(el).name()))])
    console.log('Debug mode: ' + debugMode)

    let wasMuted = false
    let timeOutSet = false
    let banOnNextConnect = false
    let captcha = ''
    let lastStichprobenTime = 0
    let timeOut

    event.on('poke', function(msg) {
        if(timeOutSet && msg.client.uid() === UID) {
            if(msg.text === captcha) {
                clearTimeout(timeOut)
                timeOutSet = false
                msg.client.poke('✔')
                log('Poke received, timer stopped')
            } else {
                msg.client.poke(msg.text + ' sollte ' + captcha + ' sein')
                log('Wrong captcha')
            }
        }
    })

    event.on('clientMove', function(ev) {
        if(ev.fromChannel == undefined && ev.client.uid() === UID && banOnNextConnect) {
            ev.client.ban(banTime,'Idlemeister')
            banOnNextConnect = false
            log('Banned on reconnect')
        }
    })


    function checkAFK() {
        let client = backend.getClientByUniqueID(UID)

        if(client) {

            let currentChannel = client.getChannels()
            log('Client ' + client.name() + ' (' + client.uid() + ') is in idle channel ' + idleChannelList.includes(currentChannel[0].id()) + ' (' + currentChannel[0].name() + ')')

            if(client.isMuted() || client.isDeaf() || client.isAway()) {

                wasMuted = true
                log('Client is muted')

            } else if(!timeOutSet && !wasMuted && !(idleChannelList.includes(currentChannel[0].id())) && client.getIdleTime() > maxIdleTime) {

                startTimer(client)
                log('Idling detected, timer started')

            } else if(!timeOutSet && !wasMuted && !(idleChannelList.includes(currentChannel[0].id()))) {

                if((client.getOnlineTime() / 60000) <= lastStichprobenTime)
                    lastStichprobenTime = 0

                if(tryStichprobe((client.getOnlineTime() / 60000) - lastStichprobenTime))
                    stichProbe(client)

            } else if(wasMuted) {

                wasMuted = false
                log('Client was muted before, wasMuted set to false')

            }
        } else {
            log('Client isnt on Teamspeak')
        }
    }

    function stichProbe(client) {

        for(i = 0; i < 6; i++) {
            client.poke('!!! STICHPROBE !!!')
        }

        lastStichprobenTime = client.getOnlineTime / 60000

        startTimer(client)
        log('Stichprobe gestartet')
    }

    function captchaGenerator() {
        let alphabet = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'
        let numbers = '1234567890'
        let captcha = ''

        for(i = 0; i < 5; i++) {
            if(getRandom(5) < 2) {
                captcha = captcha.concat(numbers.charAt(getRandom(numbers.length)))
            } else {
                captcha = captcha.concat(alphabet.charAt(getRandom(alphabet.length)))
            }
        }

        log('Captcha generated ' + captcha)
        return captcha
    }

    function getRandom(max) {
        return Math.floor(Math.random() * max)
    }

    function startTimer(client) {
        captcha = captchaGenerator()

        client.poke('Bitte folgenden Text zurückschreiben')
        client.poke(captcha)

        timeOutSet = true
        timeOut = setTimeout(function() {

            client.kickFromServer('Hör auf zu idlen')
            timeOutSet = false
            banOnNextConnect = true
            log('Client didnt poke bot in time')

        },60000)
    }

    function tryStichprobe(onlineTime) {

        let probability = 0.2 * Math.pow(Math.E,-20 * Math.pow(Math.E, -((1/20) * onlineTime)))

        if(isNaN(probability))
            log(onlineTime)

        log(`Current Stichproben probability: ${probability}`)

        if(probability > Math.random())
            return true
        else
            return false
    }

    function log(message) {
        if(debugMode) {
            engine.log(`[${meta.name} > DEBUG] ${message}`)
        }
    }

    setInterval(checkAFK, 140 * 1000)
});