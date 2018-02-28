//
// Test module for BostinAPI_mb.js
//
// Initial version is to try and get some unit testing working
// based on
//    https://www.npmjs.com/package/aws-sdk-mock
//
// Test the submitdata functionality
//


// TODO: Need to add response code 400 for when AWS doesn't respond

"use strict";

var AWS = require('aws-sdk-mock');

const chai = require('chai');
const expect = require('chai').expect;

chai.use(require('chai-http'));

const app = require('../BostinAPI_mb.js');

// To be removed
var device0 = ["3355054600", 'RPi_3B', 'RPi on workbench']
var device1 = ["165456298", 'RPi_Zero', 'RPi by Cosy Sensor']
var device2 = ["135080095", 'RPi_Sens', 'Rpi on windowsil']
var device3 = ["1234567890", 'RPi_test1', 'RPi test 1 fictitions']
var device4 = ["258963452", 'RPi_test2', 'RPi test 2 fictitions']
var device5 = ["759624153", 'RPi_test3', 'RPi test 3 fictitions']


var response;
var reply, test;

var item;

var rdl_tests = [
    {
        desc: "NO test defined yet",
//        resp: { "Items": [{ "Devices": {
//            0: {"DeviceID": device0[0], "DeviceAcroynm": device0[1], "DeviceDescription": device0[2] },
//            1: {"DeviceID": device1[0], "DeviceAcroynm": device1[1], "DeviceDescription": device1[2] },
//            }}]},
        correct: [1,2,3,4,5,6,7,8,9  ],
        limit: 100,
        code: 200,
        qty: 2
    },
];
 
rdl_tests.forEach( function(test) {

    describe('TEST API endpoint /submitdata, TEST everything', function() {
        // Unit test the retrieve device list functionality for multiple users
        // No need to authenticate users as this has already been proven
        // Checks for correct data content and quantity of readings

        after(function() {
            // stuff to do after the test has run
            AWS.restore('DynamoDB.DocumentClient');
        });

        beforeEach(function() {
            // Stuff to do before the test runs
            // Mock the user authentication - this has been validated elsewhere
            AWS.mock('DynamoDB.DocumentClient', 'get', function (params, callback) {
                response = { "Item": {"Password" : "pssaword"}};      // Data format response is ['Item']['Password'] = password
                callback(null, response);
            });

//            AWS.mock('DynamoDB.DocumentClient', 'query', function (params, callback) {
//                response = test.resp;        
//                callback(null, response);
//            });
        });


        it('should validate that '+test.desc+' are returned is complete', function() {
            return chai.request(app)
            .get('/retrievesensorvalues')
            .send({dest: 'DBLocal', id: "l@mlb.com", auth: "pssaword", limit: test.limit})
            .catch(err => err.response)
            .then(function(res) {
                reply = JSON.parse(res.text)
                expect(res).to.have.status(test.code);
                expect(reply).to.deep.equal(test.correct);
                expect(reply.length).to.equal(test.qty);
                });
            }
        )
    })
});
