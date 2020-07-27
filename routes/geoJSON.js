var express = require('express');
var pg = require('pg');
var geoJSON = require('express').Router();
var fs = require('fs');

var configtext=""+fs.readFileSync("/home/studentuser/certs/postGISConnection.js");

//convert the configuration file into the correct format -i.e. a name/value pair array
var configarray = configtext.split(",");
var config = {};
for (var i = 0; i < configarray.length; i++) {
    var split = configarray[i].split(':');
    config[split[0].trim()] = split[1].trim();
}
var pool = new pg.Pool(config);
console.log(config);

geoJSON.route('/testGeoJSON').get(function(req,res){
	res.json({message:req.originalUrl});
});

geoJSON.post('/insertQuestion',(req,res) => {
    console.dir(req.body);

    pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        }
        // pull the geometry component together
        // note that well known text requires the points as longitude/latitude !
        // well known text should look like: 'POINT(-71.064544 42.28787)'
        var param1 = req.body.longitude;
        var param2 = req.body.latitude;
        var param3 = req.body.question_title;
        var param4 = req.body.question_text;
        var param5 = req.body.answer_1 ;
        var param6 = req.body.answer_2 ;
        var param7 = req.body.answer_3;
        var param8 = req.body.answer_4;
        var param9 = req.body.port_id;
        var param10 = req.body.correct_answer ;
     
        // no need for injection prevention for st_geomfromtext as if 
        // the lat/lng values are not numbers it will not process them at all 
        // impossible to run a statement such as st_geomfromtext('POINT(delete from public.formdata')
        var geometrystring = "st_geomfromtext('POINT("+req.body.longitude+" "+req.body.latitude+")',4326)";
        var querystring = "INSERT into public.quizquestions (question_title, question_text, answer_1,answer_2, answer_3, answer_4,port_id,correct_answer,location) values ";
        querystring += "($1,$2,$3,$4,$5,$6,$7,$8,";
        querystring += geometrystring + ")";
      
        console.log(querystring);
        client.query( querystring,[param3,param4,param5,param6,param7,param8,param9,param10],function(err,result) {
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
        res.status(200).send("Question "+ req.body.question_text+ " has been inserted");
        });
    });
});

geoJSON.post('/insertAnswer',function(req,res){
  // note that we are using POST here as we are uploading data
  // so the parameters form part of the BODY of the request rather than the RESTful API
  console.dir(req.body);

  pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        }

var param1 =  req.body.port_id ;
var param2 =  req.body.question_id ;
var param3 =  req.body.answer_selected;
var param4 =  req.body.correct_answer ;


var querystring = "INSERT into public.quizanswers (port_id, question_id, answer_selected, correct_answer) values (";
querystring += "$1,$2,$3,$4)";
        console.log(querystring);
        client.query(querystring,[param1,param2,param3,param4],function(err,result) {
          done();
          if(err){
               console.log(err);
               res.status(400).send(err);
          }
          res.status(200).send("Answer inserted for user "+req.body.port_id);
       });
    });
});



geoJSON.get('/getGeoJSON/:port_id', function (req,res) {
     pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        }
          var colnames = "id, question_title, question_text, answer_1,";
          colnames = colnames + "answer_2, answer_3, answer_4, port_id, correct_answer";
          console.log("colnames are " + colnames);

          // now use the inbuilt geoJSON functionality
          // and create the required geoJSON format using a query adapted from here:
          // http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html, accessed 4th January 2018
          // note that query needs to be a single string with no line breaks so built it up bit by bit
         var querystring = " SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM ";
          querystring += "(SELECT 'Feature' As type     , ST_AsGeoJSON(lg.location)::json As geometry, ";
          querystring += "row_to_json((SELECT l FROM (SELECT "+colnames + " ) As l      )) As properties";
          querystring += "   FROM public.quizquestions As lg ";
         querystring += " where port_id = $1 limit 100  ) As f ";
          console.log(querystring);
          var port_id = req.params.port_id; //
          // run the second query
          client.query(querystring,[port_id],function(err,result){
            //call `done()` to release the client back to the pool
            done();
            if(err){
                  console.log(err);
                  res.status(400).send(err);
             }
            res.status(200).send(result.rows);
        });
    });

});



geoJSON.get('/getGeoJSON/:tablename/:geomcolumn', function (req,res) {
     pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        } 

        var colnames = "";


        var tablename = req.params.tablename;
        var geomcolumn = req.params.geomcolumn;
        var querystring = "select string_agg(colname,',') from ( select column_name as colname ";
        querystring = querystring + " FROM information_schema.columns as colname ";
        querystring = querystring + " where table_name   =$1";
        querystring = querystring + " and column_name <> $2 and data_type <> 'USER-DEFINED') as cols ";

            console.log(querystring);
            

            client.query(querystring,[tablename,geomcolumn], function(err,result){
              if(err){
                console.log(err);
                    res.status(400).send(err);
            }
            thecolnames = result.rows[0].string_agg;
            colnames = thecolnames;
            console.log("the colnames "+thecolnames);




            var querystring = " SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM ";
            querystring = querystring + "(SELECT 'Feature' As type     , ST_AsGeoJSON(lg." + req.params.geomcolumn+")::json As geometry, ";
            querystring = querystring + "row_to_json((SELECT l FROM (SELECT "+colnames + ") As l      )) As properties";
            

            if (req.params.portNumber) {
                querystring = querystring + "   FROM "+req.params.tablename+"  As lg where lg.port_id = '"+req.params.portNumber + "' limit 100  ) As f ";
            }
            else {
                querystring = querystring + "   FROM "+req.params.tablename+"  As lg limit 100  ) As f ";
            }
            console.log(querystring);

            
            client.query(querystring,function(err,result){
           
            done(); 
            if(err){    
                            console.log(err);
                    res.status(400).send(err);
             }
            res.status(200).send(result.rows);
        });
        
        });
    });
});

// geoJSON.post('/deleteFormData',(req,res) => {
//     console.dir(req.body);
//     pool.connect(function(err,client,done) {
//         if(err){
//             console.log("not able to get connection "+ err);
//             res.status(400).send(err);
//         }
//         var param1 = req.body.port_id ;
//         var param2 =  req.body.id ;
//         var querystring = "DELETE from public.quizquestions where id = $1 and port_id = $2";
//                 console.log(querystring);
//                 client.query( querystring,[param2,param1],function(err,result) {
//                 done();
//                 if(err){
//                      console.log(err);
//                      res.status(400).send(err);
//                 }
//                 res.status(200).send("Form Data with ID "+ param2+ " and port_id "+ param1 + " has been deleted (if it existed in the database)");
//              });
//       });
// });

geoJSON.get('/getCorrectAnswerNum/:port_id', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="select array_to_json (array_agg(c)) from (SELECT COUNT(*) AS num_questions from public.quizanswers where (answer_selected = correct_answer) and port_id = $1) c";
         var port_id = req.params.port_id;
        console.log(querystring);
        // var port_id = req.params.port_id;
        client.query(querystring,[port_id],function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});


geoJSON.get('/getRanking/:port_id', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="select array_to_json (array_agg(hh)) from (select c.rank from (SELECT b.port_id, rank()over (order by num_questions desc) as rank from (select COUNT(*) AS num_questions, port_id from public.quizanswers where answer_selected = correct_answer group by port_id) b) c where c.port_id = $1) hh";
        console.log(querystring);
        var port_id = req.params.port_id;
        client.query(querystring,[port_id],function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});

geoJSON.get('/getScore', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="select array_to_json (array_agg(c)) from (select rank() over (order by num_questions desc) as rank , port_id from (select COUNT(*) AS num_questions, port_id from public.quizanswers where answer_selected = correct_answer group by port_id) b limit 5) c";
        console.log(querystring);
        client.query(querystring, function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});

geoJSON.get('/getUserParticipation/:port_id', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="select array_to_json (array_agg(c)) from (select * from public.participation_rates where port_id = $1) c";
        console.log(querystring);
        var port_id = req.params.port_id;
        client.query(querystring,[port_id],function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});

geoJSON.get('/getallParticipation/', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="select  array_to_json (array_agg(c)) from (select day, sum(questions_answered) as questions_answered, sum(questions_correct) as questions_correct from public.participation_rates group by day) c ";
        console.log(querystring);
        client.query(querystring,function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});

geoJSON.get('/getLastQuestion/', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM (SELECT 'Feature' As type     , ST_AsGeoJSON(lg.location)::json As geometry, row_to_json((SELECT l FROM (SELECT id, question_title, question_text, answer_1, answer_2, answer_3, answer_4, port_id, correct_answer) As l  )) As properties FROM public.quizquestions  As lg where timestamp > NOW()::DATE-EXTRACT(DOW FROM NOW())::INTEGER-7  limit 100  ) As f ";
        console.log(querystring);
        client.query(querystring,function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});


geoJSON.get('/get5ClosestQ/:XXX/:YYY', function(req,res) {
    pool.connect(function(err,client,done) {
        if(err){
            console.log("not able to get connection "+ err);
            res.status(400).send(err);
        }

        var XXX = req.params.XXX;
        var YYY = req.params.YYY;

     
        var querystring = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM (SELECT 'Feature' As type     , ST_AsGeoJSON(lg.location)::json As geometry, row_to_json((SELECT l FROM (SELECT id, question_title, question_text, answer_1, answer_2, answer_3, answer_4, port_id, correct_answer) As l  )) As properties FROM   (select c.* from public.quizquestions c inner join (select id, st_distance(a.location, st_geomfromtext('POINT("+XXX+" "+ YYY+ ")',4326)) as distance from public.quizquestions a order by distance asc limit 5) b on c.id = b.id ) as lg) As f";

        
        client.query(querystring,function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });

        console.log(querystring);
    });
});

geoJSON.get('/get5DifficultQ/', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="select array_to_json (array_agg(d)) from ";
        querystring += "(select c.* from public.quizquestions c inner join ";
        querystring += "(select count(*) as incorrectanswers, question_id from public.quizanswers where ";
        querystring += "answer_selected <> correct_answer ";
        querystring += "group by question_id ";
        querystring += "order by incorrectanswers desc ";
        querystring += "limit 5) b ";
        querystring += "on b.question_id = c.id) d;";

        console.log(querystring);
        client.query(querystring,function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
        
    });
});

 
 geoJSON.get('/getLast5Q/:port_id', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }

        var querystring="SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM (SELECT 'Feature' As type     , ST_AsGeoJSON(lg.location)::json As geometry, row_to_json((SELECT l FROM (SELECT id, question_title, question_text, answer_1, answer_2, answer_3, answer_4, port_id, correct_answer, answer_correct) As l  )) As properties FROM (select a.*, b.answer_correct from public.quizquestions a inner join (select question_id, answer_selected=correct_answer as answer_correct from public.quizanswers where port_id = $1 order by timestamp desc limit 5) b on a.id = b.question_id) as lg) As f";
        console.log(querystring);
        var port_id =req.params.port_id;
        client.query(querystring,[port_id],function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
        
    });
});
 
geoJSON.get('/showProximityAlert/:port_id', function(req,res) {
    pool.connect(function(err,client,done){
        if(err){
            console.log("not able to get connect"+err);
            res.status(400).send(err);
        }
        
        var querystring="SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM (SELECT 'Feature' As type     , ST_AsGeoJSON(lg.location)::json As geometry, row_to_json((SELECT l FROM (SELECT id, question_title, question_text, answer_1, answer_2, answer_3, answer_4, port_id, correct_answer) As l  )) As properties FROM (select * from public.quizquestions where id in ( select question_id from public.quizanswers where port_id = $1 and answer_selected <> correct_answer union all select id from public.quizquestions where id not in (select question_id from public.quizanswers) and port_id = $2)) as lg) As f ";
        console.log(querystring);
        var port_id =req.params.port_id;
        client.query(querystring,[port_id],function(err,result){
            done();
            if(err){
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
        
    });
}); 


module.exports = geoJSON;