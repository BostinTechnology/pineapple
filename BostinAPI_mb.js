//
//  Databases
//  DBLocal, AWS, DBRemote - remote is the same as local, bnut indicates the sensor is remote to this device
//
// Response Codes Used
// 200 OK - Standard response for successful HTTP requests
// 400 Bad Request - The server cannot or will not process the request due to an apparent client error
// 403 Forbidden - The request was valid, but the server is refusing action.
// 501 Not Implemented - The server either does not recognize the request method, or it lacks the ability to fulfill the request. Usually this implies future availability (e.g., a new feature of a web-service API)
//
//
// TODO: Check the right http codes are used in the various responses
var express = require('express');
var app = express();
var http = require('http');
var fs = require('fs');

var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data
var AWS = require("aws-sdk");

// moved here so they are available to the functions

// These can't live here as they are global scross multiple connections!!
var userid, authcode, dest, packet;
var obj, user_name, user_auth;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

AWS.config.update({
              region: "us-west-2",
              endpoint: "http://RPi_Display:8000",
              accessKeyId: "fakeMyKeyId",
              secretAccessKey: "fakeSecretAccessKey"
            });
var dynamodb = new AWS.DynamoDB();

   
function consolelogdata (req) {
    // function to log all the possible console data to the the screen
    console.log("Parameters being passed into main function following validation of user");
    console.log("userid:"+req.body.id);
    console.log("authcode:" + req.body.auth);
    console.log("dest:" + req.body.dest);
    // All the rest are not in every case, so only display them if they exists
    if (typeof req.body.data !== 'undefined') {
        console.log("packet:" + JSON.parse(req.body.data));
    }
    if (typeof req.body.device_id !== 'undefined') {
        console.log("device_id: "+req.body.device_id);
    }
    if (typeof req.password !== 'undefined') {
        console.log("Password: "+req.password);
    }
    if (typeof req.validated !== 'undefined') {
        console.log("Validated: "+req.validated)
    }
}

function retrievesensorvalues(req, res) {
    // returns a list of the most recent 100 items from the database for the specified device

    console.log('==>retrievesensorvalues reached');

    var docClient = new AWS.DynamoDB.DocumentClient();

    var value_dataset = [];
    //context.fillText("Retriving Data", 300, 50);      //debug data
    // TODO: Need to pass in the device_id
    var params = {
        TableName: 'SensorValues',
        KeyConditionExpression: '#name = :value', // a string representing a constraint on the attribute
        ExpressionAttributeNames: { // a map of substitutions for attribute names with special characters
            '#name': 'Device_ID'
        },
        ExpressionAttributeValues: { // a map of substitutions for all attribute values
          ':value': parseInt(req.body.device_id) // 3355054600 //2480248024
        },
        ScanIndexForward: false,            // return the last xx items
        Limit: 100,
        ProjectionExpression: "MVData",
    };
    docClient.query(params, function(err, data) {
        if (err) {
            console.log("retrievesensorvalues query returned error: " + err);
            res.sendStatus(400);
        } else {
            // The followingline shows how to retrieve just the value I am interested in 
            // Need to loop it through next.
            var dataset = data['Items']; //JSON.stringify(data['Items'], undefined, 2);

            for (var i = 0; i < dataset.length; i = i + 1) {
                // scroll through the dataset returned for each item
                for (var j = 0; j < dataset[i]['MVData'].length; j = j + 1) {
                    value_dataset.push(dataset[i]['MVData'][j]['value'].valueOf());
                }
            };

            console.log("Data Returned:" + value_dataset);
            res.status(200).send(value_dataset);
            
        }
    });
}

function retrievedevicelist(req, res) {
    // returns a list of the most recent 100 items from the database for the specified device

    console.log('==>retrievesensorvalues reached');

    var docClient = new AWS.DynamoDB.DocumentClient();

    var device_list = [];
    //context.fillText("Retriving Data", 300, 50);      //debug data
    // TODO: Need to pass in the device_id
    var params = {
        TableName: 'Users',
        KeyConditionExpression: '#name = :value', // a string representing a constraint on the attribute
        ExpressionAttributeNames: { // a map of substitutions for attribute names with special characters
            '#name': 'UserName'
        },
        ExpressionAttributeValues: { // a map of substitutions for all attribute values
          ':value': req.body.id
        },
        ScanIndexForward: false,            // return the last xx items
        Limit: 100,
        ProjectionExpression: "Devices",
    };
    docClient.query(params, function(err, data) {
        if (err) {
            console.log("retrievesensorvalues query returned error: " + err);
            res.sendStatus(400);
        } else {
            // The followingline shows how to retrieve just the value I am interested in 
            // Need to loop it through next.
            var dataset = data['Items']; 

            for (var i = 0; i < dataset.length; i = i + 1) {
                device_list[i] = dataset[i]['Devices'];
            };

            console.log("Data Returned:" + JSON.stringify(device_list));
            res.status(200).send(JSON.stringify(device_list));
            // BUG: The data is return as a string, not a list
            
        }
    });
}

function retrievedbversion(res) {
    // retrieves the valid db versions from the database
    console.log('==>retrievedbversion reached');

    var docClient = new AWS.DynamoDB.DocumentClient();

    var value_dataset = [];
    //context.fillText("Retriving Data", 300, 50);      //debug data
    // TODO: Need to limit the number of values returned
    var params = {
        TableName: 'db_Version',
        KeyConditionExpression: '#name = :value', // a string representing a constraint on the attribute
        ExpressionAttributeNames: { // a map of substitutions for attribute names with special characters
            '#name': 'db_ver'
        },
        ExpressionAttributeValues: { // a map of substitutions for all attribute values
          ':value': 1
        },
        ScanIndexForward: false,            // return the last xx items
        Limit: 100,
        ProjectionExpression: "to_date, from_date, version", 
    };
    docClient.query(params, function(err, data) {
        if (err) {
            console.log("retrievedbversionvalues query returned error: " + err);
            res.sendStatus(400);
        } else {
            // The followingline shows how to retrieve just the value I am interested in 
            // Need to loop it through next.
            var dataset = data['Items'][0]; //JSON.stringify(data['Items'], undefined, 2);
            console.log("Dataset:" + JSON.stringify(dataset, undefined, 2));
            var valid_version = "-1";
            if ( dataset.hasOwnProperty('version')) {
                valid_version = dataset['version'];
            }

            console.log("Version:"+valid_version);

            res.status(200).send(valid_version);
            
        }
    });
//    context.fillText("GetItem succeeded"+value_dataset, 30, 70);
//    return value_dataset;
}

function authenticateuser(res) {
    // dummy function at present, just returns a good response
    console.log('==>authenticateuser reached');
    res.status(200);
    res.end()
}

function submitdata(req, res) {
    // given the status, write the data help in the post body (packet) to the database
    console.log("==>submitdata reached");
    
    var params = {
        TableName: 'SensorValues',
        Item: JSON.parse(req.body.data),
    };        
    console.log("submit params:" + JSON.stringify(params));
    dynamodb.putItem(params, function(err, data) {
        if (err) {
            console.log("submitdata returned an error:" + JSON.stringify(err));
            res.sendStatus(400);
            // The error text includes a "statusCode":500, "retryable":true
            // How can these be used
            
        } else
        {
            // this is called when the putItem returns
            console.log("Data Written successfully??"+JSON.stringify(data));
            // need to return positive here to the http call!!!
            console.log("message:"+JSON.stringify(data));
            res.sendStatus(200);
            
        }
    });

    console.log("submitdata completed");

    return;
}


var ValidateUserMiddleware = function(req, res, next) {
    console.log("\n******************************************");
    console.log(" RUNNING MB VERSION");
    console.log(req.path + " message received");

    console.log("\n==>ValidateUserMiddleware reached\n\n")

    var docClient = new AWS.DynamoDB.DocumentClient();
    
    var params = {
        TableName: 'Users',
        Key: { 
            "UserName": req.body.id
        },
        AttributesToGet: [ 
            'Password'
        ],
        ConsistentRead: true,
    };
    
    console.log("params:"+JSON.stringify(params));
    
    docClient.get(params, function(err, data) {
        if (err) {
            console.log("ValidateUserMiddleware returned an error:" + JSON.stringify(err));
            req.validated = false;
            next();
            // Need to sort out NEGATIVE response here to http call.
        } else
        {
            // this is called when the getting of the password returns
            console.log("Data Back:" + JSON.stringify(data, null, 2));
            req.password = data['Item']['Password'];
            if (req.body.auth == req.password) {
                console.log("\tValidated User....");
                req.validated = true;
                next();
            }
            else {
                console.log("\tInvalid Authorisation Code");
                req.validated = false;
                next();
            }
        }
    });
}
    

app.use(express.static('public'));


app.post('/submitdata', ValidateUserMiddleware, function (req, res, next) {

//    console.log("******************************************");
//    console.log(" RUNNING MB VERSION");
//    console.log("submitdata POST message values: -");

    consolelogdata(req);        // output the incoming data


    //  - Currently supporting the following destinations.
    //	- FILE = Filesystem
    //	- DBLocal = Local DynamoDB Database 
    //	- AWS = Amazon AWS
    // and save data packet to destination

    if (req.validated) {
        switch(req.body.dest) {
                case "FILE":
                    console.log("\nSending data packet to FILESYSTEM");
                    //console.log(data);
                    res.sendStatus(501);
                    break;
                    
                case "DBLocal":
                case "DBRemote":
                    console.log("\nSending data packet to "+req.body.dest+" DATABASE");
                    console.log(JSON.parse(req.body.data));

                    submitdata(req, res);

                    break;

                case "AWS":
                    console.log("\nSending data packet to Amazon AWS");
                    console.log(data);
                    res.sendStatus(501);
                    break;

                default:
                    console.log("\n\nERROR : Unrecognised destination");
                    res.sendStatus(501);
        }
    }
    else {
        console.log("*** Data has not been sent");
        res.sendStatus(403);      // Need to sort out NEGATIVE response here to http call.
    }
    console.log("\n /submitdata completed");
    });

app.get('/retrievesensorvalues', ValidateUserMiddleware, function (req, res, next) {

//    console.log("******************************************");
//    console.log(" RUNNING MB VERSION");
//    console.log("retrievesensorvalues GET message received as follows: -");

    consolelogdata(req);        // output the incoming data


    //  - Currently supporting the following destinations.
    //	- FILE = Filesystem
    //	- DBLocal = Local DynamoDB Database 
    //	- AWS = Amazon AWS
    // and save data packet to destination
    if (req.validated) {
        switch(req.body.dest) {
                case "FILE":
                    console.log("\nSending data packet to FILESYSTEM");
                    //console.log(data);
                    res.sendStatus(501);
                    break;
                    
                case "DBLocal":
                case "DBRemote":
                    console.log("\nSending data packet to "+req.body.dest+" DATABASE");

                    retrievesensorvalues(req, res);

                    break;

                case "AWS":
                    console.log("\nSending data packet to Amazon AWS");
                    console.log(data);
                    res.sendStatus(501);
                    break;

                default:
                    console.log("\n\nERROR : Unrecognised destination");
                    res.sendStatus(501);
        }
    }
    else {
        res.sendStatus(403);      // Need to sort out NEGATIVE response here to http call.
    }
    console.log("\n /retrievesensorvalues completed");

});

app.get('/retrievedevicelist', ValidateUserMiddleware, function (req, res, next) {

//    console.log("******************************************");
//    console.log(" RUNNING MB VERSION");
//    console.log("retrievesensorvalues GET message received as follows: -");

    consolelogdata(req);        // output the incoming data


    //  - Currently supporting the following destinations.
    //	- FILE = Filesystem
    //	- DBLocal = Local DynamoDB Database 
    //	- AWS = Amazon AWS
    // and save data packet to destination
    if (req.validated) {
        switch(req.body.dest) {
                case "FILE":
                    console.log("\nSending data packet to FILESYSTEM");
                    //console.log(data);
                    res.sendStatus(501);
                    break;
                    
                case "DBLocal":
                case "DBRemote":
                    console.log("\nSending data packet to "+req.body.dest+" DATABASE");

                    retrievedevicelist(req, res);

                    break;

                case "AWS":
                    console.log("\nSending data packet to Amazon AWS");
                    console.log(data);
                    res.sendStatus(501);
                    break;

                default:
                    console.log("\n\nERROR : Unrecognised destination");
                    res.sendStatus(501);
        }
    }
    else {
        res.sendStatus(403);      // Need to sort out NEGATIVE response here to http call.
    }
    console.log("\n /retrievesensorvalues completed");

});

app.get('/retrievedbversion', ValidateUserMiddleware, function (req, res, next) {
    // Returns the database version that is currently valid
//    console.log("******************************************");
//    console.log(" RUNNING MB VERSION");
//    console.log("retrievedbversions GET message received as follows: -");

    consolelogdata(req);        // output the incoming data

    //  - Currently supporting the following destinations.
    //	- FILE = Filesystem
    //	- DBLocal = Local DynamoDB Database 
    //	- AWS = Amazon AWS
    // and save data packet to destination

    if (req.validated) {
        switch(req.body.dest) {
                case "FILE":
                    console.log("\nSending data packet to FILESYSTEM");
                    //console.log(data);
                    res.sendStatus(501);
                    break;
                    
                case "DBLocal":
                case "DBRemote":
                    console.log("\nSending data packet to "+req.body.dest+" DATABASE");

                    retrievedbversion(res);

                    break;

                case "AWS":
                    console.log("\nSending data packet to Amazon AWS");
                    console.log(data);
                    res.sendStatus(501);
                    break;

                default:
                    console.log("\n\nERROR : Unrecognised destination");
                    res.sendStatus(501);
        }
    }
    else {
        res.sendStatus(403);      // Need to sort out NEGATIVE response here to http call.
    }
    console.log("/retrievedbversion completed");
});

app.get('/connected', function (req, res, next) {
    // Returns a positive response, used to confirm there is connectivity to the client
    // ONly requires the destination to confirm link ok
    console.log("\n******************************************");
    console.log(" RUNNING MB VERSION");
    console.log("connected GET message received as follows: -");

    consolelogdata(req);        // output the incoming data

    //  - Currently supporting the following destinations.
    //	- FILE = Filesystem
    //	- DBLocal = Local DynamoDB Database 
    //	- AWS = Amazon AWS
    // and save data packet to destination


    switch(req.body.dest) {
            case "FILE":
                console.log("\nChecking FILESYSTEM enabled");
                res.sendStatus(501)
                break;
                
            case "DBLocal":
            case "DBRemote":
                console.log("\nChecking "+req.body.dest+" DATABASE enabled");
                res.sendStatus(200);
                break;

            case "AWS":
                console.log("\nChecking Amazon AWS enabled");
                res.sendStatus(501);
                
                break;

            default:
                console.log("\n\nERROR : Unrecognised destination");
                res.sendStatus(501);
        }

    });

app.get('/authenticateuser', ValidateUserMiddleware, function (req, res, next) {
    // Returns the database version that is currently valid
//    console.log("******************************************");
//    console.log(" RUNNING MB VERSION");
//    console.log("authenticateuser GET message received as follows: -");

    consolelogdata(req);        // output the incoming data


    //  - Currently supporting the following destinations.
    //	- FILE = Filesystem
    //	- DBLocal = Local DynamoDB Database 
    //	- AWS = Amazon AWS
    // and save data packet to destination

    if (req.validated) {
        switch(req.body.dest) {
                case "FILE":
                    console.log("\nSending data packet to FILESYSTEM");
                    //console.log(data);
                    res.sendStatus(501);
                    break;
                    
                case "DBLocal":
                case "DBRemote":
                    console.log("\nSending data packet to "+req.body.dest+" DATABASE");

                    authenticateuser(res);

                    break;

                case "AWS":
                    console.log("\nSending data packet to Amazon AWS");
                    console.log(data);
                    res.sendStatus(501);
                    break;

                default:
                    console.log("\n\nERROR : Unrecognised destination");
                    res.sendStatus(501);
        }
    }
    else {
        res.sendStatus(403);      // Need to sort out NEGATIVE response here to http call.
    }
    console.log("/retrievedbversion completed");
    });


var server = app.listen(8080, function () {
   var host = server.address().address
   var port = server.address().port
   console.log("Bostin CognIoT API listening at http:// %s :%s", host, port)

});

// This section servers up the various web pages that are required on port 1227.
// The first page is capturing the data and storing it in the local store, but
// the displaypage is not displaying it!
http.createServer(function(req, res) {
    console.log("Webserver present on 1227");
  // Homepage
    if (req.url === "/") {
    fs.readFile('login.html', function(err, data) {
        if (err) {
            throw err;
            }
        else {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        res.end();
        }
    });
    }

    // Display data
    else if (req.url.startsWith("/displaydata")) {
        console.log("display data page called");
        fs.readFile('displaydata.html', function(err, data) {
            if (err) {
                throw err;
            }
            else {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.write(data);
                res.end();
            }
    });
    }

    // 404'd!
    else {
      console.log("File not found error");
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 error! File not found.");
    };
}).listen(1227);


