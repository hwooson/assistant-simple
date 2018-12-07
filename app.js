/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var AssistantV2 = require('watson-developer-cloud/assistant/v2'); // watson sdk

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var assistant = new AssistantV2({
    version: "2018-02-20",
    username: "apikey",
    password: process.env.ASSISTANT_PASSWORD || '<put-your-password-from-api-view>'
});
var sessionId = "<to-be-initiated>";

// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {
    var assistantId = process.env.ASSISTANT_ID || "<set-up-your-assistant-id>";
    if (!assistantId || assistantId === '<workspace-id>') {
        return res.json({
            'output': {
                'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
            }
        });
    }
    try {
        var inputText = req.body.input.text;
    } catch (err) {
        return res.json({
            'output': {
                'text': 'Messages not received yet'
            }
        })
    }

    var payload = {
        assistant_id: assistantId,
        session_id: sessionId,
        input: {
            'message_type': 'text',
            'text': inputText
        }
    };
    // Send the input to the assistant service
    assistant.message(payload, function (err, data) {
        if (err) {
            if (400 <= err.code < 500) {
                issueNewSession();
                return res.json({
                    'output': {
                        'text': 'The session might be expired. Please issue a new session to keep on the conversation.'
                    }
                })
            }
            return res.status(err.code || 500).json(err);
        }

        return res.json(updateMessage(payload, data));
    });
});

function issueNewSession() {
    assistant.createSession({
        assistant_id: process.env.ASSISTANT_ID || "<set-up-your-assistant-id>",
    }, function (err, response) {
        if (err) {
            console.error(err);
        } else {
            console.log(response);
            sessionId = response.session_id;
        }
    });
}

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Assistant service
 * @param  {Object} response The response from the Assistant service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
    var responseText = null;
    if (!response.output) {
        response.output = {};
    } else {
        return response;
    }
    if (response.intents && response.intents[0]) {
        var intent = response.intents[0];
        // Depending on the confidence of the response the app can return different messages.
        // The confidence will vary depending on how well the system is trained. The service will always try to assign
        // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
        // user's intent . In these cases it is usually best to return a disambiguation message
        // ('I did not understand your intent, please rephrase your question', etc..)
        if (intent.confidence >= 0.75) {
            responseText = 'I understood your intent was ' + intent.intent;
        } else if (intent.confidence >= 0.5) {
            responseText = 'I think your intent was ' + intent.intent;
        } else {
            responseText = 'I did not understand your intent';
        }
    }
    response.output.text = responseText;
    return response;
}

module.exports = app;