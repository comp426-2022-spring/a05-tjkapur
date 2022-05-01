const express = require('express')
const app = express()
const fs = require('fs')
const morgan = require('morgan')
const db = require("./src/services/database.js")
const minimist = require('minimist')

const args = minimist(process.argv.slice(2))
args["help", "port", "debug", "log"]

const help = (`
server.js [options]
--port	Set the port number for the server to listen on. Must be an integer
            between 1 and 65535.
--debug	If set to true, creates endlpoints /app/log/access/ which returns
            a JSON access log from the database and /app/error which throws 
            an error with the message "Error test successful." Defaults to 
            false.
--log		If set to false, no log files are written. Defaults to true.
            Logs are always written to database.
--help	Return this message and exit.
`)

if (args.help || args.h) {
    console.log(help)
    process.exit(0)
}

// port default to 5555
const port = args.port || process.env.port || 5555

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const server = app.listen(port, () => {
    console.log('App is running on port %PORT%'.replace('%PORT%', port))
})

if (args.log == true) {
    const WRITESTREAM = fs.createWriteStream('access.log', { flags: 'a' });
    app.use(morgan('combined', { stream: WRITESTREAM }));
}

app.use((req, res, next) => {
    let logData = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    const stmt = db.prepare('INSERT INTO accesslog (remoteaddr, remoteuser, time, method, url, protocol, httpversion, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(logData.remoteaddr, logData.remoteuser, logData.time, logData.method, logData.url, logData.protocol, logData.httpversion, logData.status, logData.referer, logData.useragent);
    next();
})


app.use(express.static('./public'))

// coin fns
function coinFlip() {
    return Math.random() > .5 ? 'heads' : 'tails';
}

function coinFlips(flips) {
    let array = [];
    for (let i=0; i<flips; i++) {
      array[i] = coinFlip();
    }
    return array;
}

function countFlips(array) {
    let h = 0;
    let t = 0;
  
    for (let i = 0; i < array.length; i++) {
      if (array[i] == "heads") {
        h++;
      } else if (array[i] == "tails") {
        t++;
      }
    }
  
    if (h !=0 && t != 0) {
      return {tails: t, heads: h};
    } 
  
    if (h == 0 && t == 0) {
      return {};
    }
    
    if (h == 0) {
      return {tails: t};
    }
    
    if (t == 0) {
      return {heads: h};
    }
}

function flipACoin(call) {
    let flip = coinFlip();
    if (flip == call) {
      return {
        call: call,
        flip: flip,
        result: "win"
      }
      } else {
        return {
          call: call,
          flip: flip,
          result: "lose"
        }
      }
}

// endpoints
if (args.debug) {
    app.get("/app/log/access", (req, res) => {
        try {
            const stmt = db.prepare('SELECT * FROM accesslog').all()
            res.status(200).json(stmt)
        } catch(e) {
            console.error(e)
        }
    })
    app.get("/app/error", (req, res) => {
        throw new Error('Error Test Successful')
    })
}

app.get('/app/', (req, res) => {
    res.status(200).end('OK')
    res.type("text/plain")
})

app.get('/app/flip/', (req, res) => {
    var flip = coinFlip()
    res.status(200).json({'flip' : flip})
})

app.get('/app/flips/:number/', (req, res) => {
    var flips = coinFlips(req.params.number)
    res.status(200).json({'raw': flips, 'summary': countFlips(flips)})
})

app.get('/app/flip/call/tails/', (req, res) => {
    var flip = flipACoin('tails')
    res.status(200).json(flip)
})

app.get('/app/flip/call/heads/', (req, res) => {
    var flip = flipACoin('heads')
    res.status(200).json(flip)
})

//default
app.use(function(req, res) {
    res.status(404).send("Endpoint does not exist")
    res.type("text/plain")
})


