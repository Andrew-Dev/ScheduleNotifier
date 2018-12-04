const Twilio = require('twilio');
const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser')

const secrets = require('./secrets');

const twilioClient = new Twilio(secrets.sid, secrets.authToken);

const notificationTable = {}

class Notifier {
    constructor(config) {
        if(fs.existsSync(config)) {
            const rawFileContent = fs.readFileSync(config,'utf8');
            this.config = JSON.parse(rawFileContent);
        }
    }

    run() {
        //reset notification table every day
        setTimeout(() =>
            notificationTable = {}
        ,1000 * 60 * 60 * 24);
        // run through CRNS at interval
        this.config.crns.forEach((crn,i) => {
            setTimeout(()=>{
                console.log("Monitoring CRN " + crn);
                setInterval(()=>{
                    const url = 'https://selfservice.mypurdue.purdue.edu/prod/bwckschd.p_disp_detail_sched?term_in=201920&crn_in=' + crn;
                    console.log('Request to ' + url);
                    axios.get(url).then(res => {
                        const $ = cheerio.load(res.data);
                        cheerioTableparser($);
                        const table = $('table[summary*=seating]');
                        const titleObj = $('table[summary*=detailed] > tbody > tr > th');
                        const title = titleObj.text();
                        const parsedTable = table.parsetable(true,true,true);
                        console.log(parsedTable)
                        console.log(title);
                        console.log('Total Seats:',parsedTable[2][1], 'Remaining Seats:',parsedTable[3][1]);
                        this.notify(crn,title,parsedTable[3][1]);
                    })
                },this.config.spaceRate*this.config.crns.length)
            },i*this.config.spaceRate);
        })
    }

    notify(crn,title,remaining) {
        if(parseInt(remaining) > 0 && !notificationTable[crn]) {
            notificationTable[crn] = true;
            twilioClient.messages.create({
                body: `[${remaining} SEATS] - ${title} - Drop everything and register!`,
                to: secrets.phone,  // Text this number
                from: secrets.twilioPhone // From a valid Twilio number
            })
            .then((message) => console.log(message.sid));            
        }

    }
}

const notifier = new Notifier('config.json');
notifier.run();