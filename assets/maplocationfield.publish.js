jQuery(document).ready(function() {	
	jQuery('fieldset .field-maplocation').each(function() {
		try {
			var field = new MapLocationField(jQuery(this));
		} catch(e) {
			console.log(e);
		}
	});
});

	Symphony.Language.add({
		'Latitude/Longitude': false,
		'Goto address': false,
		'Update Map': false,
		'No results': false,
		'Multiple matches': false
	});
	

function MapLocationField(field) {
	
	// cache the field container DOM element (jQuery)
	this.field = field;
	
	// placeholders
	this.map = null;
	this.geocoder = null;
	this.marker = null;
	
	this.inputs = {
		coordinates: field.find('label.coordinates input'),
		centre: field.find('label.centre input'),
		zoom: field.find('label.zoom input')
	}

  // precision for coordinates
  // The sixth decimal place is worth up to 0.11 m see —> https://gis.stackexchange.com/questions/8650/measuring-accuracy-of-latitude-and-longitude#answer-8674
  this.precision = 6;
	
	// go!
	this.init();
};

MapLocationField.prototype.init = function() {
	var self = this;

	// hide the input fields
	for(var input in this.inputs) {
		this.inputs[input].parent().hide();
	}
	
	// build field HTML
	var html = jQuery(
    '<div class="frame">' +
      '<div class="tab-panel tab-map inline">' +
        '<div id="map"></div>' +
      '</div>' +
      '<div class="tab-panel tab-edit inline">' +
        '<fieldset class="coordinates">' +
          '<label>' + Symphony.Language.get('Latitude/Longitude') + '</label>' +
          '<input type="text" name="latitude" class="text"/><input type="text" name="longitude" class="text"/>' +
          '<input type="button" value="' + Symphony.Language.get('Update Map') + '" class="button"/>' +
        '</fieldset>' +
        '<fieldset class="geocode">' +
          '<label>' + Symphony.Language.get('Goto address') + '</label>' +
          '<input type="text" name="address" class="text"/>' +
          '<input type="button" value="' + Symphony.Language.get('Update Map') + '" class="button"/>' +
        '</fieldset>' +
      '</div>' +
    '</div>'
	).prependTo(this.field);
		
	// get initial map values from the DOM input fields
	var initial_coordinates = this.parseLatLng(this.inputs.coordinates.val());
	var initial_centre = this.parseLatLng(this.inputs.centre.val());
	var initial_zoom = parseInt(this.inputs.zoom.val());
	
	// add the map
  var map = L.map('map', {
    scrollWheelZoom: true
  }).setView(initial_centre, initial_zoom);
  
  // Layers
  var osm = new 
  L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 1
  });

  var otm = new 
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Kartendaten: © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: © <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    minZoom: 1
  });

  var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // Default Layer
	map.addLayer(osm);

  // Layer controls
  var baseMaps = {
  "OpenStreetMap": osm,
	"OpenTopoMap": otm,
	"Esri World Imagery": Esri_WorldImagery
	};
	L.control.layers(baseMaps, null, {collapsed: true}).addTo(map);
  
	// Add draggable marker
  var marker = new L.marker(initial_coordinates,{
    draggable: true,
    autoPan: true
	}).addTo(map);

	// store the updated values to the DOM
  self.storeCoordinates(marker.getLatLng());
	self.storeCentre(map.getCenter());
	self.storeZoom(map.getZoom());

  // bind events to store new values
	marker.on('dragend', function (e) {
		self.storeCoordinates(marker.getLatLng());
		self.storeCentre(map.getCenter());
	});
	map.on('dragend', function (e) {
		self.storeCentre(map.getCenter());
	});
	map.on('zoomend', function() {
		self.storeZoom(map.getZoom());
	});
	
	
	// bind edit tab actions
	this.field.find('fieldset.coordinates input.text').bind('keypress', function(e) {
		if(e.keyCode == 13) {
			e.preventDefault();
			self.editLatLng(map, marker);
			self.storeCoordinates(marker.getLatLng());
			self.storeCentre(map.getCenter()); // works only when off-bounds?
		}
	});
	this.field.find('fieldset.geocode input.text').bind('keypress', function(e) {
		if(e.keyCode == 13) {
			e.preventDefault();
			self.editAddress(map, marker);
		}
	});
	this.field.find('fieldset.coordinates input.button').bind('click', function() {
		self.editLatLng(map, marker);
		self.storeCoordinates(marker.getLatLng());
		self.storeCentre(map.getCenter()); // works only when off-bounds?
	});
	this.field.find('fieldset.geocode input.button').bind('click', function() { self.editAddress(map, marker) });
	
};



MapLocationField.prototype.storeCoordinates = function(latLng) {
	this.inputs.coordinates.val(parseFloat(latLng.lat).toFixed(this.precision) + ', ' + parseFloat(latLng.lng).toFixed(this.precision));
	this.field.find('div.tab-edit input[name=latitude]').val(parseFloat(latLng.lat).toFixed(this.precision));
	this.field.find('div.tab-edit input[name=longitude]').val(parseFloat(latLng.lng).toFixed(this.precision));;
}


MapLocationField.prototype.storeZoom = function(zoom) {
	this.inputs.zoom.val(zoom);
}

MapLocationField.prototype.storeCentre = function(latLng) {
	this.inputs.centre.val(parseFloat(latLng.lat).toFixed(this.precision) + ', ' + parseFloat(latLng.lng).toFixed(this.precision));
}

MapLocationField.prototype.parseLatLng = function(string) {
	return string.match(/-?\d+\.\d+/g);
}

MapLocationField.prototype.editLatLng = function(map, marker) {
	var fieldset = this.field.find('fieldset.coordinates');
	var lat = fieldset.find('input[name=latitude]').val();
	var lng = fieldset.find('input[name=longitude]').val();	
  map.setView([lat, lng]);
  marker.setLatLng([lat, lng]);
}

MapLocationField.prototype.editAddress = function(map, marker) {
	var self = this;
	var fieldset = this.field.find('fieldset.geocode');
	
	var button = fieldset.find('input[type=button]');
	var address_field = fieldset.find('input[name=address]');

	var button_value = button.val();
	button.val('Loading …').attr('disabled', 'disabled');

	var label = fieldset.find('label');
	label.find('i').remove();
	
	// create a geocoder
	var addresserror = Symphony.Language.get('No results');
	var multi = Symphony.Language.get('Multiple matches');
	var openStreetMapGeocoder = GeocoderJS.createGeocoder('openstreetmap');
	var adresse = address_field.val();
	
	openStreetMapGeocoder.geocode(adresse, function(result) {
		if (result == 0) {
			// no address found
			button.val(button_value).removeAttr('disabled');
			label.append('<i>' + addresserror + '</i>')
		} else {
		  // Results!
		  button.val(button_value).removeAttr('disabled');
		  
		  // Multiple matches found
		  if (Object.keys(result).length > 1) {
		    label.append('<i>' + multi + '</i>');
		  } else {
				label.find('i').remove();
			}
			
			var lat = result[0]['latitude'];
			var lng = result[0]['longitude'];
			
			map.setView([lat, lng], 15);
			marker.setLatLng([lat, lng]);
			self.storeCoordinates(marker.getLatLng());
			self.storeCentre(map.getCenter());
			self.storeZoom(map.getZoom());
			
		}
	});

}