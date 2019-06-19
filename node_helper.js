const NodeHelper = require('node_helper');

const querystring = require('querystring');
const request = require('request');
const url = require('url');

module.exports = NodeHelper.create({
    start: function() {
        // Nothing to be done here yet
    },

    socketNotificationReceived: function(notif, payload) {
        if (notif === "GET_ARRIVAL") {
            this.getArrival(payload);
        }
    },

    getArrival: function(input) {
        var self = this;
        var urlargs = {
            appID: input.appId,
            arrivals: input.arrivalCount,
            json: true,
            locIDs: input.stopIds.join(),
            minutes: input.minutes
        };
        // TODO: Probably a better way to assemble the URL
        var fullurl = input.arrivalUrl + "?" + querystring.stringify(urlargs);
        request({url: fullurl}, function (err, resp, body) {
            var ret = {
                error: false,

                arrivals: [],
                locations: []
            };
            var body_obj = JSON.parse(body);
            if (err || resp.statusCode != 200) {
                ret.error = true;
            } else {
                ret.arrivals = body_obj.resultSet.arrival;
                ret.locations = body_obj.resultSet.location;
            }
            self.sendSocketNotification("MMM-TRIMET_NODE_GET_ARRIVAL", ret);
        });
    }
});