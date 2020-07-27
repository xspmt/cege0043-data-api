var express = require('express');
var pg = require('pg');
var crud = require('express').Router();
var fs = require('fs');
var configtext = ""+fs.readFileSync("/home/studentuser/certs/postGISConnection.js");

// now convert the configruation file into the correct format -i.e. a name/value pair array
var configarray = configtext.split(",");
var config = {};
for (var i = 0; i < configarray.length; i++) {
    var split = configarray[i].split(':');
    config[split[0].trim()] = split[1].trim();
}
var pool = new pg.Pool(config);
console.log(config);

crud.route('/testCRUD').get(function (req,res) { 
	res.json({message:req.body});
});

crud.post('/insertFormData',(req,res) => {
	console.dir(req.body);

    pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        }
      	// pull the geometry component together
      	// note that well known text requires the points as longitude/latitude !
      	// well known text should look like: 'POINT(-71.064544 42.28787)'
    	var param1 = req.body.longitude ;
      	var param2 =  req.body.latitude ;

      	var param3 =  req.body.name ;
      	var param4 =  req.body.surname ;
      	var param5 = req.body.module;
      	var param6 = req.body.language;
      	var param7 = req.body.modulelist;
      	var param8 = req.body.lecturetime ;
      	var param9 =  req.body.port_id ;
     
      	// no need for injection prevention for st_geomfromtext as if 
      	// the lat/lng values are not numbers it will not process them at all 
      	// impossible to run a statement such as st_geomfromtext('POINT(delete from public.formdata')
      	var geometrystring = " st_geomfromtext('POINT("+req.body.latitude+" "+req.body.longitude+")',4326)";
      	var querystring = "INSERT into public.formdata(name,surname,module,language, modulelist,lecturetime, port_id,location) values ";
      	querystring += "($1,$2,$3,$4,$5,$6,$7,";
      	querystring += geometrystring + ")";
      
      	console.log(querystring);
      	client.query( querystring,[param3,param4,param5,param6,param7,param8,param9],function(err,result) {
      		done();
        	if(err){
            	console.log(err);
            	res.status(400).send(err);
        	}
        res.status(200).send("Form Data "+ req.body.name+ " has been inserted");
      	});
    });
});

crud.post('/deleteFormData',(req,res) => {
    console.dir(req.body);
    pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        }
      	var param1 = req.body.port_id ;
      	var param2 =  req.body.id ;
      	var querystring = "DELETE from public.formdata where id = $1 and port_id = $2";
                console.log(querystring);
                client.query( querystring,[param2,param1],function(err,result) {
                done();
                if(err){
                     console.log(err);
                     res.status(400).send(err);
                }
                res.status(200).send("Form Data with ID "+ param2+ " and port_id "+ param1 + " has been deleted (if it existed in the database)");
             });
      });
});

module.exports = crud;
