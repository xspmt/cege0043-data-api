//express is the server that forms part of the nodejs program
var express = require('express');
var path = require("path");
var fs = require('fs');
var app = express();
const bodyParser = require('body-parser');

// add an https server to serve files 
var https = require('https');

var privateKey = fs.readFileSync('/home/studentuser/certs/cert.key').toString();
var certificate = fs.readFileSync('/home/studentuser/certs/cert.crt').toString();  

var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, app);

httpsServer.listen(4480);
app.use(bodyParser.urlencoded({extended: true}));


app.get('/',function (req,res) {
	res.send("Hello World from the demo HTTPS Server on port 4480");
});

//adding functionality to log the requests
app.use(function (req, res, next) {
	var filename = path.basename(req.url);
	var extension = path.extname(filename);
	console.log("The file " + filename + " was requested.");
	next();
});

//adding functionality to allow cross-origin queries when PhoneGap is running a server
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


const geoJSON = require('./routes/geoJSON');
app.use('/', geoJSON);

const crud = require('./routes/crud');
app.use('/', crud);

app.use(express.static(__dirname));