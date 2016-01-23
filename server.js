var express = require('express');
var app = express();
var mysql = require('mysql');
var bodyParser = require('body-parser');
app.use(bodyParser.json());

//azure mysql server for final use
// var pool = mysql.createPool({
//   connectionLimit: 4,
//   host: '***REMOVED***',
//   user: '***REMOVED***',
//   password: '***REMOVED***',
//   database: 'farm'
// });

//local mysql server
var pool = mysql.createPool({
  connectionLimit: 4,
  host: 'localhost',
  user: 'root',
  password: '***REMOVED***',
  database: 'farm'
});

// This responds with "Hello Farmer" on the homepage
app.get('/', function (req, res) {
   console.log("Got a GET request for the homepage");
   res.send('Hello Farmer');
})

// requesting details of each sensor
app.get('/request', function (req, res) {
    var sensor_id = req.query.sensor_id;
    console.log(sensor_id);
    var QueryString = "SELECT sensor_id, current_value, crop_name, motor_status, auto, pin_no FROM farm_data_sensor, farm_data_crop WHERE crop_id=id AND sensor_id=" + sensor_id + " LIMIT 1";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
      connection.query(QueryString, function(err, results) {
        console.log(results);
        res.end(JSON.stringify(results[0]));
        connection.release();   // Don't use the connection here, it has been returned to the pool.
      });
    });
})

// requesting details of all sensor values. used at the start of the app
app.get('/requestall', function(req, res) {
  var aadhaar_id = req.query.farmer_id;
  console.log(farmer_id);
  var QueryString = "SELECT sensor_id, current_value FROM farm_data_sensor WHERE farmer_id=" + aadhaar_id;
  console.log(QueryString);
  pool.getConnection(function(err, connection) {
    connection.query(QueryString, function(err, results) {
      console.log(results);
      res.end(JSON.stringify(results));
      connection.release();
    });
  });
})

//for toggling auto from the app to the edison board
app.get('/auto', function(req, res) {
  var sensor_id = req.query.sensor_id;
  console.log(sensor_id);
  var enable = req.query.enable;
  console.log(enable);
  var QueryString = "UPDATE farm_data_sensor SET auto=" + enable + " WHERE sensor_id=" + sensor_id + " LIMIT 1";
  console.log(QueryString);
  pool.getConnection(function(err, connection) {
    connection.query(QueryString, function(err, results) {
      console.log("toggled");
      res.end("toggled");
      io.emit('auto_toggle', {sensor_id: sensor_id, state: enable});
      connection.release();
    });
  });
})

//for toggling motor from the app to the edison board
app.get('/motor', function(req, res) {
  var sensor_id = req.query.sensor_id;
  console.log(sensor_id);
  var enable = req.query.enable;
  console.log(enable);
  var QueryString = "UPDATE farm_data_sensor SET motor_status=" + enable + " WHERE sensor_id=" + sensor_id + " LIMIT 1";
  console.log(QueryString);
  pool.getConnection(function(err, connection) {
    connection.query(QueryString, function(err, results) {
      console.log("motor");
      res.end("motor");
      io.emit('motor_toggle', {sensor_id: sensor_id, state: enable});
      connection.release();
    });
  });
})

//login from app
app.get('/login', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var password = req.query.password;
    var QueryString = "SELECT aadhaar_no, password from farm_data_farmer WHERE aadhaar_no='" + aadhaar_id + "' LIMIT 1";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
      // Use the connection
      connection.query(QueryString, function(err, results) {
        if (err) {
          console.log("Query failed login" + err);
          return;
        }

          if (results.length == 0) {
            res.statusCode = 401;
            res.end();
            return;
          }

          if (results[0].password == password) {
            res.statusCode = 202;
            var QueryString = "SELECT sensor_id FROM farm_data_farmer, farm_data_sensor WHERE aadhaar_no=farmer_id AND aadhaar_no='" + aadhaar_id + "'";
            connection.query(QueryString, function(err, results) {
                if (err) {
                  console.log("Query failed");
                  return;
                }
                else {
                  res.end(JSON.stringify(results));
                }
              });
          }
          else {
            res.statusCode = 401;
            res.end();
            return;
          }
      });
      connection.release();
    });
})

//initial request from edison for initializing sensor ids and pin nos
app.get('/setup_config', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var QueryString = "SELECT sensor_id, pin_no, auto, threshold, motor_status FROM farm_data_sensor, farm_data_crop WHERE crop_id=id AND farmer_id='" + aadhaar_id + "'";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
      connection.query(QueryString, function(err, results) {
        if (err) {
          console.log("Query failed setup");
          return;
        }
        console.log(results);
        res.end(JSON.stringify(results));
        connection.release();
      });
    });
})

//handling the signup of user from app. creates a new user in the table does not add new sensors.
app.get('/sign_up', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var name = req.query.name;
    var mobile_no = req.query.mobile_no;
    var password = req.query.password;
    if (aadhaar_id == undefined || name == undefined || mobile_no == undefined || password == undefined) {
      res.statusCode = 406;
      res.end('Incomplete data');
      return;
    }
    else if(aadhaar_id == '' || name == '' || mobile_no == '' || password == '') {
      res.statusCode = 406;
      res.end('Incomplete data');
      return;
    }
    var QueryString = "SELECT * from farm_data_farmer WHERE aadhaar_no='" + aadhaar_id + "'";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
      connection.query(QueryString, function(err, results) {
        if (err) {
            console.log("Query failed Finding aadhaar ID");
          return;
        }
        if (results.length != 0) {
          res.statusCode = 401;
          res.end('User Already Exists');
          return;
        }
        else {
          var QueryString = "INSERT into farm_data_farmer values ('" + name + "','" + aadhaar_id + "','" + mobile_no + "','" + password + "')";
          console.log(QueryString);
          connection.query(QueryString, function(err, results) {
            if (err) {
              console.log("Query failed insert");
              return;
            }
            console.log('New User Inserted');
            res.end('New User Inserted');
          });
        }
        connection.release();
      });
    });
})

//for retrieves all crop names for spinner in settings.
app.get('/retrieve_all_crops', function(req, res) {
    var QueryString = "select crop_name from farm_data_crop";
    pool.getConnection(function(err, connection) {
      connection.query(QueryString, function(err, results) {
        if (err) {
          console.log("Query failed Retrieve_all_crops");
          return;
        }
        console.log(results);
        res.end(JSON.stringify(results));
        connection.release();
      });
    });
})

//gets new sensor from app.
app.post('/new_sensor_setting',function(req, res) {
    var crop_id = req.body.crop_id;
    var pin_no = req.body.pin_no;
    var aadhaar_id = req.body.aadhaar_id;
    var QueryString = "INSERT into farm_data_sensor (farmer_id, crop_id, auto, motor_status, current_value, time_updated, pin_no)  values('" + aadhaar_id + "', '" + crop_id + "', 0, 0, 0, NOW(), '" + pin_no + "')";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
              console.log("Query failed new sensor settings");
              return;
            }
            res.end('sensor saved');
            connection.release();
        });
    });
})

//curl -d '{"aadhaar_id":"123456789012","crop_id":"1","pin_no":"4"}' -H "Content-Type: application/json" http://localhost:8080/new_sensor_setting

//edit current crop of sensor
app.get('/edit_sensor_settings', function(req, res) {
    var crop_id = req.query.crop_id;
    var sensor_id = req.query.sensor_id;
    var QueryString = "UPDATE farm_data_sensor SET crop_id = '"+ crop_id + "' WHERE sensor_id = " + sensor_id +";";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Query failed edit sensor setting");
                return;
            }
            res.end('sensor edited');
            connection.release();
        });
    });
})

//delete sensor based on sensor_id
app.get('/delete_sensor', function(req, res)    {
    var sensor_id = req.query.sensor_id;
    var aadhaar_id = req.query.aadhaar_id;
    var QueryString = "DELETE from farm_data_sensor WHERE sensor_id = "+ sensor_id +";";
    console.log(QueryString);
    pool.getConnection(function(err, connection)    {
        connection.query(QueryString, function(err, results)    {
            if(err) {
                console.log("Query failed delete sensor");
                return;
            }
            QueryString = "SELECT sensor_id FROM farm_data_sensor WHERE farmer_id=" + aadhaar_id;
            connection.query(QueryString, function(err, results) {
                console.log(results);
                res.end(JSON.stringify(results));
            });
            connection.release();
        });
    });
})

//adding a new sensor from app
app.get('/add_sensor', function(req, res)   {
    var aadhaar_id = req.query.aadhaar_id;
    var crop_id = req.query.crop_id;
    var pin_no = req.query.pin_no;
    var QueryString = "INSERT into farm_data_sensor (farmer_id, crop_id, auto, motor_status, current_value, time_updated, pin_no)  values('" + aadhaar_id + "', '" + crop_id + "', 0, 0, 0, NOW(), '" + pin_no + "')";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, insertResult) {
            if (err) {
              console.log("Query failed new sensor settings");
              return;
            }
            QueryString = "SELECT sensor_id FROM farm_data_sensor WHERE farmer_id=" + aadhaar_id;
            connection.query(QueryString, function(err, results) {
                //console.log(results);
                addSensorResponse = {};
                addSensorResponse.sensors = results;
                addSensorResponse.insertId = insertResult.insertId;
                console.log(addSensorResponse);
                res.end(JSON.stringify(addSensorResponse));
            });
            connection.release();
        });
    });
})

app.post('/testpost', function(req, res){
  console.log(req.body);      // your JSON
  res.end(JSON.stringify(req.body));    // echo the result back
});
//curl -d '{"MyKey":"My Value","lKEY":"test"}' -H "Content-Type: application/json" http://127.0.0.1:8080/testpost

//wildcard for all other calls apart fromt the specified.
app.get('/*', function(req, res) {
    res.statusCode = 401;
    res.end('appadiya');
})

//deleting 30day old values once everyday
setInterval(function () {
    var QueryString = "DELETE FROM farm_data_sensedvalue WHERE time_recorded < NOW() - INTERVAL 30 DAY;";
    console.log(QueryString);
    pool.getConnection(function(err, connection) {
      connection.query(QueryString, function(err, results) {
        console.log(results);
        connection.release();   // Don't use the connection here, it has been returned to the pool.
      });
    });
}, 8640000);

var server = app.listen(process.env.PORT || 8080, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("App listening at http://%s:%s", host, port)

})

var io = require('socket.io')(server);
io.on('connection', function(socket) {
  socket.on('new_value', function(newSensorData) {
    pool.getConnection(function(err, connection) {
      for (var i = 0; i < newSensorData.length; i++) {
        var QueryString = "UPDATE farm_data_sensor SET current_value=" + newSensorData[i].sensor_value + ", time_updated=NOW(), motor_status=" + newSensorData[i].motor_status + " WHERE sensor_id=" + newSensorData[i].sensor_id + " LIMIT 1";
        console.log(QueryString);
        // Use the connection
        connection.query(QueryString, function(err, results) {
          if (err) {
            console.log("Error updating" + err);
          }
          console.log("Got new value");
        });
        QueryString = "INSERT into farm_data_sensedvalue (sensor_id,value) values ("+newSensorData[i].sensor_id+ "," + newSensorData[i].sensor_value + ");";
        console.log(QueryString);
        connection.query(QueryString, function(err, results) {
          if (err) {
            console.log("Error inserting in sensed value" + err);
          }
          console.log("Got new sensed value");
        });
      }
      connection.release();
    });

  });
});
