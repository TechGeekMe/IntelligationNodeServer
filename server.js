var express = require('express');
var app = express();
var mysql = require('mysql');
var bodyParser = require('body-parser');
var colors = require('colors');
app.use(bodyParser.json());

colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    info: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    success: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

// azure mysql server for final use
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
app.get('/', function(req, res) {
    res.send('Hello Farmer');
    console.log("Request at ./".info + ":success".success)
})

// requesting details of each sensor
app.get('/request', function(req, res) {
    var sensor_id = req.query.sensor_id;
    //console.log(sensor_id);
    var QueryString = "SELECT sensor_id, current_value, crop_name, motor_status, auto, pin_no FROM farm_data_sensor, farm_data_crop WHERE crop_id=id AND sensor_id=" + sensor_id + " LIMIT 1";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./request".info + ":fail".error + ":sql query error".warn)
                return
            }
            //console.log(results);
            console.log("Request at ./request".info + ":success".success)
            res.end(JSON.stringify(results[0]));
            connection.release(); // Don't use the connection here, it has been returned to the pool.
        });
    });
})

// requesting details of all sensor values. used at the start of the app
app.get('/requestall', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var QueryString = "SELECT sensor_id FROM farm_data_sensor WHERE farmer_id=" + aadhaar_id;
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./requestall".info + ":fail".error + ":sql query error".warn)
                return;
            }
            //console.log(results);
            console.log("Request at ./requestall".info + ":success".success)
            res.end(JSON.stringify(results));
            connection.release();
        });
    });
})

//for toggling auto from the app to the edison board
app.get('/auto', function(req, res) {
    var sensor_id = req.query.sensor_id;
    //console.log(sensor_id);
    var enable = req.query.enable;
    //console.log(enable);
    var QueryString = "UPDATE farm_data_sensor SET auto=" + enable + " WHERE sensor_id=" + sensor_id + " LIMIT 1";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./auto".info + ":fail".error + ":sql query error".warn)
                return;
            }
            res.end("Toggled Auto sensorID=" + sensor_id);
            io.emit('auto_toggle', {
                sensor_id: sensor_id,
                state: enable
            });
            console.log("Request at ./auto".info + ":success".success);
            connection.release();
        });
    });
})

//for toggling motor from the app to the edison board
app.get('/motor', function(req, res) {
    var sensor_id = req.query.sensor_id;
    //console.log(sensor_id);
    var enable = req.query.enable;
    //console.log(enable);
    var QueryString = "UPDATE farm_data_sensor SET motor_status=" + enable + " WHERE sensor_id=" + sensor_id + " LIMIT 1";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./motor".info + ":fail".error + ":sql query error".warn)
                return
            }
            //console.log("motor");
            res.end("Toggled Motor SensorID=" + sensor_id);
            io.emit('motor_toggle', {
                sensor_id: sensor_id,
                state: enable
            });
            console.log("Request at ./motor".info + ":success".success);
            connection.release();
        });
    });
})

//login from app
app.get('/login', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var password = req.query.password;
    var QueryString = "SELECT aadhaar_no, password from farm_data_farmer WHERE aadhaar_no='" + aadhaar_id + "' LIMIT 1";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        // Use the connection
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./login".info + ":fail".error + ":sql query error".warn);
                return;
            }
            if (results.length == 0) {
                console.log("Request at ./login".info + ":fail".error + ": user not found".warn)
                res.statusCode = 401;
                res.end();
                return;
            }
            if (results[0].password == password) {
                res.statusCode = 202;
                var QueryString = "SELECT sensor_id FROM farm_data_sensor WHERE farmer_id='" + aadhaar_id + "'";
                //console.log(QueryString);
                connection.query(QueryString, function(err, results) {
                    if (err) {
                        console.log("Request at ./login".info + ":query fail".error + ":sql query error".warn);
                        return;
                    } else {
                        console.log("Request at ./login".info + ":success".success)

                        var QueryString = "SELECT lat, lon FROM farm_data_farmer WHERE aadhaar_no='" + aadhaar_id + "'";
                        //console.log(QueryString);
                        connection.query(QueryString, function(err, resul) {
                            if (err) {
                                console.log("Request at ./login".info + ":query fail".error + ":sql query error".warn);
                                return;
                            } else {
                                console.log("Request at ./login".info + ":success".success)
                                var response = {
                                  location: resul[0],
                                  sensors: results
                                }
                                res.end(JSON.stringify(response));
                            }
                        });
                    }
                });
            } else {
                console.log("Request at ./login".info + ":fail".error + ": incorrect password".warn)
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
    //var aadhaar_id = req.query.aadhaar_id;
    var device_id = req.query.device_id;
    //var QueryString = "SELECT sensor_id, pin_no, auto, threshold, motor_status FROM farm_data_sensor, farm_data_crop WHERE crop_id=id AND farmer_id='" + aadhaar_id + "'";
    var QueryString = "SELECT sensor_id, pin_no, auto, threshold, motor_status from farm_data_sensor, farm_data_crop WHERE crop_id=id AND farmer_id = (select aadhaar_no from farm_data_farmer where device_id = '" + device_id + "');"
        //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./setup_config".info + ":fail".error + ":sql query error".warn);
                return;
            }
            //console.log(results);
            res.end(JSON.stringify(results));
            console.log("Request at ./setup_config".info + ":success".success)
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
    var device_id = req.query.device_id;
    var lat = req.query.lat;
    var lon = req.query.lon;
    //console.log("Recieved data: "+ JSON.stringify(req.query));
    if (aadhaar_id == undefined || name == undefined || mobile_no == undefined || password == undefined || device_id == undefined || lat == undefined || lon == undefined) {
        res.statusCode = 406;
        res.end('Incomplete data');
        console.log("Request at ./sign_up".info + ":fail".error + ":Incomplete data".warn);
        return;
    } else if (aadhaar_id == '' || name == '' || mobile_no == '' || password == '' || device_id == '' || lat == '' || lon == '') {
        res.statusCode = 406;
        res.end('Incomplete data');
        console.log("Request at ./sign_up".info + ":fail".error + ":Incomplete data".warn);
        return;
    }
    var QueryString = "SELECT * from farm_data_farmer WHERE aadhaar_no='" + aadhaar_id + "'";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./sign_up".info + ":fail".error + ":sql query error".warn);
                return;
            }
            if (results.length != 0) {
                res.statusCode = 401;
                res.end('User Already Exists');
                console.log("Request at ./sign_up".info + ":fail".error + ": user exists".warn)
                return;
            } else {
                var QueryString = "INSERT into farm_data_farmer values ('" + device_id + "','" + name + "','" + aadhaar_id + "','" + mobile_no + "','" + password + "'," + lat + "," + lon + ")";
                //console.log(QueryString);
                connection.query(QueryString, function(err, results) {
                    if (err) {
                        console.log("Request at ./sign_up".info + ":fail".error + ":sql query error".warn);
                        return;
                    }
                    console.log("Request at ./sign_up".info + ":success".success);
                    res.end('New User Inserted');
                });
            }
            connection.release();
        });
    });
})

app.get('/sign_up_device', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var name = req.query.name;
    var mobile_no = req.query.mobile_no;
    var password = req.query.password;
    var lat = req.query.lat;
    var lon = req.query.lon;
    //console.log("Recieved data: "+ JSON.stringify(req.query));
    if (aadhaar_id == undefined || name == undefined || mobile_no == undefined || password == undefined || lat == undefined || lon == undefined) {
        res.statusCode = 406;
        res.end('Incomplete data');
        console.log("Request at ./sign_up_device".info + ":fail".error + ":Incomplete data".warn);
        return;
    } else if (aadhaar_id == '' || name == '' || mobile_no == '' || password == '' || lat == '' || lon == '') {
        res.statusCode = 406;
        res.end('Incomplete data');
        console.log("Request at ./sign_up_device".info + ":fail".error + ":Incomplete data".warn);
        return;
    }
    var QueryString = "SELECT * from farm_data_farmer WHERE aadhaar_no='" + aadhaar_id + "'";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./sign_up_device".info + ":fail".error + ":sql query error".warn);
                return;
            }
            if (results.length != 0) {
                res.statusCode = 401;
                res.end('User Already Exists');
                console.log("Request at ./sign_up_device".info + ":fail".error + ": user exists".warn)
                return;
            } else {
                var QueryString = "SELECT device_id FROM manufacturer_data_device_data WHERE aadhaar_id='" + aadhaar_id + "'";
                //console.log(QueryString);
                connection.query(QueryString, function(error, resul) {
                    if (error) {
                        console.log("Request at ./sign_up_device".info + ":fail".error + ":sql query error".warn);
                        return;
                    }
                    if(resul.length == 0) {
                      res.statusCode = 402;
                      res.end('User not registered');
                      console.log("Request at ./sign_up_device".info + ":fail".error + ": user not registered".warn)
                      return;
                    }
                    //console.log(JSON.stringify(resul));
                    var device_id = resul[0].device_id;
                    var QueryString = "INSERT into farm_data_farmer values ('" + device_id + "','" + name + "','" + aadhaar_id + "','" + mobile_no + "','" + password + "'," + lat + "," + lon + ")";
                    //console.log(QueryString);
                    connection.query(QueryString, function(err, results) {
                        if (err) {
                            console.log("Request at ./sign_up_device".info + ":fail".error + ":sql query error".warn);
                            return;
                        }
                        console.log("Request at ./sign_up_device".info + ":success".success);
                        res.end('New User Inserted');
                    });
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
                console.log("Request at ./retrieve_all_crops".info + ":fail".error + ":sql query error".warn);
                return;
            }
            //console.log(results);
            res.end(JSON.stringify(results));
            console.log("Request at ./retrieve_all_crops".info + ":success".success)
            connection.release();
        });
    });
})

//gets new sensor from app.
app.post('/new_sensor_setting', function(req, res) {
    var crop_id = req.body.crop_id;
    var pin_no = req.body.pin_no;
    var aadhaar_id = req.body.aadhaar_id;
    var QueryString = "INSERT into farm_data_sensor (farmer_id, crop_id, auto, motor_status, current_value, time_updated, pin_no)  values('" + aadhaar_id + "', '" + crop_id + "', 0, 0, 0, NOW(), '" + pin_no + "')";
    pool.getConnection(function(err, connection) {
    //console.log(QueryString);
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./new_sensor_setting".info + ":fail".error + ":sql query error".warn);
                return;
            }
            res.end('sensor saved');
            connection.release();
            console.log("Request at ./new_sensor_setting".info + ":success".success);
        });
    });
})

//curl -d '{"aadhaar_id":"123456789012","crop_id":"1","pin_no":"4"}' -H "Content-Type: application/json" http://localhost:8080/new_sensor_setting

//edit current crop of sensor
app.get('/edit_sensor_settings', function(req, res) {
    var crop_id = req.query.crop_id;
    var sensor_id = req.query.sensor_id;
    var QueryString = "UPDATE farm_data_sensor SET crop_id = '" + crop_id + "' WHERE sensor_id = " + sensor_id + ";";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./edit_sensor_settings".info + ":fail".error + ":sql query error".warn);
                return;
            }
            res.end('sensor edited');
            console.log("Request at ./edit_sensor_settings".info + ":success".success)
            connection.release();
        });
    });
})

//delete sensor based on sensor_id
app.get('/delete_sensor', function(req, res) {
    var sensor_id = req.query.sensor_id;
    var aadhaar_id = req.query.aadhaar_id;
    var QueryString = "DELETE from farm_data_sensor WHERE sensor_id = " + sensor_id + ";";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./delete_sensor".info + ":fail".error + ":sql query error".warn);
                return;
            }
            QueryString = "SELECT sensor_id FROM farm_data_sensor WHERE farmer_id=" + aadhaar_id;
            connection.query(QueryString, function(err, results) {
                console.log("Request at ./delete_sensor".info + ":success".success);
                res.end(JSON.stringify(results));
            });
            connection.release();
        });
    });
})

//adding a new sensor from app
app.get('/add_sensor', function(req, res) {
    var aadhaar_id = req.query.aadhaar_id;
    var crop_id = req.query.crop_id;
    var pin_no = req.query.pin_no;
    var QueryString = "INSERT into farm_data_sensor (farmer_id, crop_id, auto, motor_status, current_value, time_updated, pin_no)  values('" + aadhaar_id + "', '" + crop_id + "', 0, 0, 0, NOW(), '" + pin_no + "')";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, insertResult) {
            if (err) {
                console.log("Request at ./add_sensor".info + ":fail".error + ":sql query error".warn);
                return;
            }
            QueryString = "SELECT sensor_id FROM farm_data_sensor WHERE farmer_id=" + aadhaar_id;
            connection.query(QueryString, function(err, results) {
                //console.log(results);
                addSensorResponse = {};
                addSensorResponse.sensors = results;
                addSensorResponse.insertId = insertResult.insertId;
                //console.log(addSensorResponse);
                res.end(JSON.stringify(addSensorResponse));
                console.log("Request at ./add_sensor".info + "success".success)
            });
            connection.release();
        });
    });
})

app.get('/get_stats', function(req, res) {
    var sensor_id = req.query.sensor_id;
    var QueryString = "SELECT value,time_recorded FROM  farm_data_sensedvalue WHERE sensor_id =" + sensor_id;
    //console.log(QueryString);
    data = {}
    data.sensor_id = sensor_id
    pool.getConnection(function(err, connection) {
        connection.query(QueryString, function(err, results) {
            if (err) {
                console.log("Request at ./get_stats".info + ":fail".error);
                return;
            }
            QueryString = "SELECT crop_name FROM farm_data_sensor, farm_data_crop WHERE sensor_id=" + sensor_id + " AND crop_id = farm_data_crop.id"
            connection.query(QueryString, function(err, cropResult) {
                if (err) {
                    console.log("Request at ./get_stats".info + ":fail".error + ":sql query error".warn);
                    return
                }
                data.crop = cropResult[0].crop_name
                console.log("Request at ./get_stats".info + "success".success);
                data.values = results
                res.end(JSON.stringify(data));
                connection.release();
            })
        });
    });
})
app.post('/testpost', function(req, res) {
    //console.log(req.body);      // your JSON
    res.end(JSON.stringify(req.body)); // echo the result back
});
//curl -d '{"MyKey":"My Value","lKEY":"test"}' -H "Content-Type: application/json" http://127.0.0.1:8080/testpost
app.get('/clearOldEntries', function(req, res) {
        deleteOldEntries();
        res.end("Cleared")
    })
    //wildcard for all other calls apart fromt the specified.
app.get('/*', function(req, res) {
    res.statusCode = 401;
    res.end('appadiya');
})

function deleteOldEntries() {
    var QueryString = "DELETE FROM farm_data_sensedvalue WHERE time_recorded < NOW() - INTERVAL 30 DAY;";
    //console.log(QueryString);
    pool.getConnection(function(err, connection) {
      connection.query(QueryString, function(err, results) {
        //console.log(results);
        if(err) {
            console.log("Request at /clearOldEntries".info+":fail".fail+":sql query error".warn);
            return
        }
        console.log("Request at /clearOldEntries".info+":success".success)
        connection.release();   // Don't use the connection here, it has been returned to the pool.
      });
    });
}
//deleting 30day old values once everyday
setInterval(deleteOldEntries, 8640000);

var server = app.listen(process.env.PORT || 8080, function() {

    var host = server.address().address
    var port = server.address().port

    console.log("App listening at http://%s:%s".bgRed.bold.underline, host, port)

})

var io = require('socket.io')(server);
io.on('connection', function(socket) {
    socket.on('new_value', function(newSensorData) {
        pool.getConnection(function(err, connection) {
            for (var i = 0; i < newSensorData.length; i++) {
                var QueryString = "UPDATE farm_data_sensor SET current_value=" + newSensorData[i].sensor_value + ", time_updated=NOW(), motor_status=" + newSensorData[i].motor_status + " WHERE sensor_id=" + newSensorData[i].sensor_id + " LIMIT 1";
                //console.log(QueryString);
                // Use the connection
                connection.query(QueryString, function(err, results) {
                    if (err) {
                        console.log("Socket on /new_value".info + "fail".fail + ":sensor".help + ":sql query error".warn);
                    }
                    console.log("Socket on /new_value".info + "success".success + ":sensor".help);
                });
                QueryString = "INSERT into farm_data_sensedvalue (sensor_id,value) values (" + newSensorData[i].sensor_id + "," + newSensorData[i].sensor_value + ");";
                //console.log(QueryString);
                connection.query(QueryString, function(err, results) {
                    if (err) {
                        console.log("Socket on /new_value".info + "fail".fail + ":sensed".help + ":sql query error".warn);
                    }
                    console.log("Socket on /new_value".info + "success".success + ":sensed".help);
                });
            }
            connection.release();
        });
    });
    socket.on('sensor_refresh', function(newSensorData) {
        pool.getConnection(function(err, connection) {
            var QueryString = "UPDATE farm_data_sensor SET current_value=" + newSensorData.sensor_value + ", time_updated=NOW(), motor_status=" + newSensorData.motor_status + " WHERE sensor_id=" + newSensorData.sensor_id + " LIMIT 1";
            //console.log(QueryString);
            // Use the connection
            connection.query(QueryString, function(err, results) {
                if (err) {
                    console.log("Socket on /sensor_refresh".info + "fail".fail + ":sql query error".warn);
                }
                console.log("Socket on /sensor_refresh".info + "success".success);
            });
            connection.release();
        });
    });
});
