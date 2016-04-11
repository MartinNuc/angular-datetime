/* eslint-env jasmine */

var formats = [
	"yyyy-MM-dd HH:mm:ss",
	"medium",
	"short",
	"fullDate",
	"longDate",
	"mediumDate",
	"shortDate",
	"mediumTime",
	"shortTime",
	",sss .sss",
	"yyyy-MM-dd",
	"Z"
];

function jsKeydown(elementId, code){
	var oEvent = document.createEvent('KeyboardEvent');

	// Chromium Hack: filter this otherwise Safari will complain
	if( navigator.userAgent.toLowerCase().indexOf('chrome') > -1 ){
		Object.defineProperty(oEvent, 'keyCode', {
			get : function() {
				return this.keyCodeVal;
			}
		});
		Object.defineProperty(oEvent, 'which', {
			get : function() {
				return this.keyCodeVal;
			}
		});
	}

	if (oEvent.initKeyboardEvent) {
		oEvent.initKeyboardEvent("keydown", true, true, document.defaultView, false, false, false, false, code, code);
	} else {
		oEvent.initKeyEvent("keydown", true, true, document.defaultView, false, false, false, false, code, 0);
	}

	oEvent.keyCodeVal = code;

	if (oEvent.keyCode !== code) {
		console.log("keyCode mismatch " + oEvent.keyCode + "(" + oEvent.which + ") -> "+ code);
	}

	document.getElementById(elementId).dispatchEvent(oEvent);
}

function insertColon(timezone) {
	if (timezone[3] == ":") {
		return timezone;
	}
	return timezone.substr(0, 3) + ":" + timezone.substr(3, 2);
}

function randomTimezone(){
	var offset = Math.floor(Math.random() * 24 * 60) - 12 * 60,
		sign = offset >= 0 ? "+" : "-",
		absOffset = Math.abs(offset),
		hour = Math.floor(absOffset / 60),
		min = absOffset % 60,
		text = sign + num2str(hour, 2, 2) + num2str(min, 2, 2);
	return {
		time: offset * 60 * 1000,
		text: text
	};
}

function num2str(num, minLength, maxLength) {
	var i;
	num = "" + num;
	if (num.length > maxLength) {
		num = num.substr(num.length - maxLength);
	} else if (num.length < minLength) {
		for (i = num.length; i < minLength; i++) {
			num = "0" + num;
		}
	}
	return num;
}

describe("datetime service", function(){

	angular.forEach(formats, function(format){
		describe("Format: " + format, function(){
			var datetime, $date, parser, date, viewValue, modelValue,
				$rootScope, element;

			beforeEach(angular.mock.module("datetime"));

			beforeEach(angular.mock.inject(function(_datetime_, $filter){
				datetime = _datetime_;
				$date = $filter("date");
			}));

			beforeEach(angular.mock.inject(function($compile, _$rootScope_){
				$rootScope = _$rootScope_;
				element = $compile("<input type='text' datetime='{{format}}' ng-model='date'>")($rootScope);
			}));
			
			it("test viewValue", function(){
				parser = datetime(format);
				date = new Date();

				parser.setDate(date);
				viewValue = parser.getText();

				expect(viewValue).toEqual($date(date, format));
			});

			it("test modelValue", function(){
				parser.parse(viewValue);
				modelValue = parser.getDate();

				// 'yy' is ambigous in shortDate/short
				if (format == "shortDate" || format == "short") {
					modelValue.setFullYear(date.getFullYear());
				}

				expect(modelValue.getTime()).toEqual(date.getTime());
			});
		});
	});

	describe("test duplicate name and state change", function(){

		var datetime, parser;

		beforeEach(angular.mock.module("datetime"));

		beforeEach(angular.mock.inject(function(_datetime_){
			datetime = _datetime_;
		}));

		it("create parser", function(){
			parser = datetime("yyyy-yyyy");
			parser.parse("2000-2000");
		});

		it("operate on right hand", function(){
			try {
				parser.parse("2000-2001");
			} catch (er) {
				expect(er.properText).toEqual("2001-2001");
			}
		});

		it("operate on left hand", function(){
			try {
				parser.parse("2001-2000");
			} catch (er) {
				expect(er.properText).toEqual("2001-2001");
			}
		});

		it("Tuesday, May 19, 2015", function(){
			parser = datetime("fullDate");
			parser.parse("Tuesday, May 5, 2015");
			try {
				parser.parse("Tuesday, May 1, 2015");
			} catch (er) {
				expect(er.properText).toEqual("Friday, May 1, 2015");
			}
			parser.parse("Friday, May 1, 2015");
			try {
				parser.parse("Friday, May 19, 2015");
			} catch (er) {
				expect(er.properText).toEqual("Tuesday, May 19, 2015");
			}
			parser.parse("Tuesday, May 19, 2015");

			expect(parser.getText()).toEqual("Tuesday, May 19, 2015");
			
			try {
				parser.parse("Monday, May 19, 2015");
			} catch (er) {
				expect(er.properText).toEqual("Monday, May 18, 2015");
			}
			
			parser.parse("Monday, May 18, 2015");

			parser.parse("Sunday, May 17, 2015");
			parser.parse("Sunday, May 17, 2015");			
		});
		
		it("31 date overflow", function(){
			parser = datetime("medium");
			
			parser.parse("Mar 31, 2016 6:19:20 PM");
			parser.parse("Apr 1, 2016 10:42:20 AM");
		});
	});

	describe("test initial value", function(){

		var datetime, parser, date, $date;

		it("Create parser", function(){
			angular.mock.module("datetime");
			angular.mock.inject(function(_datetime_, $filter){
				datetime = _datetime_;
				$date = $filter("date");
			});
			parser = datetime("fullDate");
			date = new Date(parser.date.getTime());
		});

		it("getDate should match current date", function(){
			expect(parser.getDate().getTime()).toEqual(date.getTime());
		});

		it("getText", function(){
			expect(parser.getText()).toEqual($date(date, "fullDate"));
		});
	});
	
	describe("test timezone", function(){
		var datetime, parser, date, $date;

		it("Create parser", function(){
			angular.mock.module("datetime");
			angular.mock.inject(function(_datetime_, $filter){
				datetime = _datetime_;
				$date = $filter("date");
			});
			parser = datetime("medium");
			date = new Date(parser.date.getTime());
		});
		
		it("utc time + offset should be equal if the local time is the same", function(){
			var r1 = randomTimezone(),
				r2 = randomTimezone(),
				text = parser.getText(),
				t1, t2;
				
			parser.setTimezone(r1.text);
			parser.parse(text);
			t1 = parser.getDate().getTime();
			
			parser.setTimezone(r2.text);
			parser.parse(text);
			t2 = parser.getDate().getTime();
			
			expect(t1 + r1.time).toEqual(t2 + r2.time);
		});

	});
});

describe("datetime directive", function(){
	var $rootScope, $date, $compile;
	
	beforeEach(angular.mock.module("datetime"));
	
	beforeEach(angular.mock.inject(function(_$compile_, _$rootScope_, $filter){
		$rootScope = _$rootScope_;
		$date = $filter("date");
		$compile = _$compile_;
	}));
	
	angular.forEach(formats, function(format){
		it(format, function(){
			$rootScope.format = format;
			$rootScope.date = new Date;
			
			var element = $compile("<input type='text' datetime='{{format}}' ng-model='date'>")($rootScope);

			$rootScope.$digest();
			
			expect(element.val()).toEqual($date($rootScope.date, format));
		});
	});
	
	it("timezone and utc", function(){
		$rootScope.date = new Date;
		
		var element = $compile("<input type='text' datetime='Z' ng-model='date' datetime-utc>")($rootScope);
		
		$rootScope.$digest();
		
		expect(element.val()).toEqual("+0000");
	});

	it("should allow : when using Z:Z token", function(){
		$rootScope.date = new Date;

		var element = $compile("<input type='text' datetime='ZZ' ng-model='date'>")($rootScope),
			value;

		$rootScope.$digest();
		
		expect(element.val()).toEqual(insertColon($date($rootScope.date, "Z")));
	});

	it("datetime-model", function(){
		var date = new Date;
		$rootScope.dateString = $date(date, "yyyy-MM-dd HH:mm:ss");
		var element = $compile("<input type='text' datetime='medium' datetime-model='yyyy-MM-dd HH:mm:ss' ng-model='dateString'>")($rootScope);
		
		$rootScope.$digest();
		
		expect(element.val()).toEqual($date(date, "medium"));
	});

	it("should jump to the next segment on separator press", function(){

		var date = new Date();
		$rootScope.date = new Date();
		var element = $compile("<input id='datetime-input' type='text' >")($rootScope);

		$rootScope.$digest();

		var input = element.find('input');

		input.triggerHandler('focus');
		element.triggerHandler({
			type: 'keydown',
			which: 51
		});

		element.triggerHandler({
			type: 'keypress',
			which: 51
		});

		var replacementText = "3";
		var sel, range;
		if (window.getSelection) {
			sel = window.getSelection();
			console.log(sel)
			if (sel.rangeCount) {
				range = sel.getRangeAt(0);
				range.deleteContents();
				range.insertNode(document.createTextNode(replacementText));
			}
		} else if (document.selection && document.selection.createRange) {
			range = document.selection.createRange();
			range.text = replacementText;
		}

		element.triggerHandler({
			type: 'keyup',
			which: 51
		});

		date.setHours(3);
		console.debug(element.val(), $date(date, "HH:mm:ss"));
		expect(element.val()).toEqual($date(date, "HH:mm:ss"));
	});

});
