Module.register("MMM-Trimet", {
    defaults: {
        appId: null,                // AppID needs to be set in the config file
        arrivalCount: 2,            // A minimum of this many arrivals
        arrivalUrl: "https://developer.trimet.org/ws/v2/arrivals",
        maxTotalArrivals: 6,        // Max number of arrivals to display
        maxStopNameLen: 25,
        minutes: 20,                // Trimet default = 20
        stopIds: [7631, 7789, 8343, 9831],          // Up to 10 stops
        updateInterval: 15000,     // 15 seconds (in milliseconds)
        cache: {
            arrivals: [],
            locations: {},
            now: null
        }
    },

    getStyles: function (){
        return ["trimet.css", "font-awesome.css"];
    },

    start: function() {
        // Configuration checking
        if (this.config.appId === null) {
            Log.error("Need to set an appid");
            return;
        }
        if (this.config.arrivalCount > 10) {
            Log.log("Arrival count seemed high. Set to 10");
            this.config.arrivalCount = 10
        }
        if (this.config.stopIds.length > 10 || this.config.stopIds.length == 0) {
            Log.error("Invalid stopIds setup");
            return;
        }
        if (this.config.minutes > 60) {
            Log.log("Minutes max is 60; setting to 60");
            return;
        }
        if (this.config.updateInterval < 15000 || this.config.updateInterval > 60000) {
            Log.log("Update interval seemed a little off. Setting to default");
            this.config.updateInterval = this.defaults.updateInterval;
        }

        this.loaded = false;

        // Create a placeholder
        var place = document.createElement('div');
        place.id = "MMM-Trimet";
    },

    getDom: function() {
        var wrap_div = document.createElement('div');
        wrap_div.classList.add('mmm-trimet-full-wide');
        wrap_div.id = "MMM-Trimet";

        if (!this.loaded) {
            return wrap_div;
        }

        for (i=0; i < this.config.stopIds.length; i++) {
            var elem = this.config.stopIds[i];
            var stop_div = document.createElement('div');
            stop_div.id = 'stopid_' + elem;
            stop_div.classList.add('mmm-trimet-full-wide')

            var stop_txt = document.createElement('div');
            stop_txt.classList.add('mmm-trimet-stop-name');
            stop_txt.classList.add('medium')
            stop_txt.innerHTML += this.config.cache.locations[elem].desc.slice(0, this.config.maxStopNameLen);
            stop_div.appendChild(stop_txt);

            // Create the arrival table
            var stop_table = document.createElement('table')
            stop_table.id = 'stopid_' + elem + '_table'
            stop_table.classList.add('small');
            stop_div.appendChild(stop_table);

            wrap_div.appendChild(stop_div);
        }

        // Handle arrivals
        for (i=0; i < this.config.cache.arrivals.length; i++) {
            // If we use multiple stop IDs it puts all of the results togeter.
            // We need to handle separating them
            var elem = this.config.cache.arrivals[i];
            var stop_div = wrap_div.querySelector('#stopid_' + elem.locid);
            if (stop_div === null) {
                Log.error("Could not find stop for ID: " + elem.locid);
                continue;
            }
            var stop_table = stop_div.querySelector('#stopid_' + elem.locid + "_table");

            if (stop_table.childElementCount >= this.config.maxTotalArrivals) {
                continue;
            }

            // Add a line for this entry
            var arr_line = document.createElement('tr');
            arr_line.classList.add('small');
            arr_line.classList.add('dimmed');
            arr_line.id = "arrid_" + elem.id;

            // Calculate a time difference
            var time = elem.scheduled;
            var live = false;
            if (elem.status == "estimated") {
                live = true;
                time = elem.estimated;
            }
            var tdiff = (time - this.config.cache.now) / 1000 / 60; // Convert to minutes
            tdiff = Math.round(tdiff);

            // Line and short name
            var arr_name = document.createElement('td')
            arr_name.classList.add('mmm-trimet-line-short');
            arr_name.innerHTML = elem.shortSign;
            arr_line.appendChild(arr_name);

            // Estimated time
            var arr_time = document.createElement('td')
            arr_time.classList.add('mmm-trimet-time');
            if (tdiff <= 0) {
                arr_time.innerHTML = 'DUE';
            } else {
                arr_time.innerHTML = tdiff + " min.";
            }
            arr_line.appendChild(arr_time);

            // Live / Scheduled
            var arr_live = document.createElement('td')
            arr_live.classList.add('mmm-trimet-live');
            if (live) {
                arr_live.innerHTML = "LIVE";
            } else {
                arr_live.innerHTML = "sched";
            }
            arr_line.appendChild(arr_live);

            stop_table.appendChild(arr_line);
        }

        return wrap_div;
    },

    socketNotificationReceived: function(notif, payload) {
        // Check for error
        if (payload.error) {
            Log.error("Notification " + notif + " failed with an error");
            return;
        }

        // Handle new arrival data
        if (notif == "MMM-TRIMET_NODE_GET_ARRIVAL") {
            this.config.cache.now = Date.now();
            this.config.cache.arrivals = payload.arrivals;

            // Assemble a location object keyed by stop ID
            for (i=0; i < payload.locations.length; i++) {
                var elem = payload.locations[i];
                this.config.cache.locations[elem.id] = elem;
            }
            this.loaded = true;
            this.updateDom();
        }
    },

    notificationReceived: function(notif, payload, sender) {
        var self = this;

        if (notif === 'DOM_OBJECTS_CREATED') {
            const arrival_payload = {
                appId: this.config.appId,
                arrivalCount: this.config.arrivalCount,
                arrivalUrl: this.config.arrivalUrl,
                stopIds: this.config.stopIds,
                minutes: this.config.minutes
            }
            this.sendSocketNotification("GET_ARRIVAL", arrival_payload);

            setInterval(function() {
                self.sendSocketNotification("GET_ARRIVAL", arrival_payload);
            }, this.config.updateInterval);
        }
    }
});