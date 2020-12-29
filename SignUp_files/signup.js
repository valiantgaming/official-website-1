"use strict";

var API_ROOT = window.API_ROOT;
var APP_URL = window.APP_URL;
var analytics = window.analytics || [];

var KTSignUpPage = function () {

	var showErrorMsg = function (form, type, msg) {
		var alert = $(`
			<div class="alert alert-bold alert-solid-${type} alert-dismissible" role="alert">
				<div class="alert-text">${msg}</div>
				<div class="alert-close">
					<i class="flaticon2-cross kt-icon-sm" data-dismiss="alert"></i>
				</div>
			</div>
		`);

		form.find('.alert').remove();
		alert.prependTo(form);
		KTUtil.animateClass(alert[0], 'fadeIn animated');
	}

	var authenticateUser = function (form, email, password) {
		var data = {
			email: email,
			password: password
		}
		axios
			.post(`${API_ROOT}/token/`, data)
			.then(response => {
				window.localStorage.setItem('token', response.data.access);
				window.localStorage.setItem('refresh', response.data.refresh);
				window.localStorage.setItem('user_email', email);
				var url = APP_URL;
				url = url + "?onboarding=true"
				if (window.location.search && window.location.href.includes("?target=")) {
					url = url + "&target=" + window.location.href.split("?target=")[1];
				}
				window.location.replace(url);
			})
			.catch(error => {
				showErrorMsg(form, 'danger', 'Something went wrong. Please try again.');
			});
	}

	var isAuthenticated = function () {
		return window.localStorage.getItem('token');
	}

	var populateLinks = function () {
		if (window.location.search && window.location.href.includes("?target=")) {
			$("#link-login").attr("href", 'login.html?' + window.location.href.split("?")[1]);
		}
	}

	var readAbstractTrackingCookie = function () {

		var name = "abs_trckng=";
		var decodedCookie = decodeURIComponent(document.cookie);
		var ca = decodedCookie.split(';');
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == ' ') {
				c = c.substring(1);
			}
			if (c.indexOf(name) == 0) {
				return c.substring(name.length, c.length);
			}
		}
		return "{}";
	}

	var getSignupSourceData = function () {

		// Read abstract cookie

		// Build signupSourceData object
		var signupSourceData = {
			'signup_initial_referring_domain': (JSON.parse(readAbstractTrackingCookie())['initial_referring_domain'] || "").substring(0,200),
			'signup_initial_referrer': (JSON.parse(readAbstractTrackingCookie())['initial_referrer'] || "").substring(0,200),
			'signup_landing_page_url': (JSON.parse(readAbstractTrackingCookie())['landing_page_url']  || "").substring(0,200),
			'signup_referrer': (document.referrer || "").substring(0,200),
			'signup_current_url': (window.location.href || "").substring(0,200),
		};

		return signupSourceData;
	}

	var handleLoginFormSubmit = function () {
		$('#kt_signup_submit').click(function (e) {
			e.preventDefault();

			var btn = $(this);
			var form = $('#kt_signup_form');

			form.validate({
				rules: {
					email: {
						required: true
					},
					password: {
						required: true
					}
				}
			});
			
			// Check if all fields are filled out
			if (!form.valid()) {
				return;
			}

			var email = $("#email").val().toLowerCase();
			var password = $("#password").val();

			KTApp.progress(btn[0]);

			setTimeout(function () {
				KTApp.unprogress(btn[0]);
			}, 2000);

			// Track signup attempt	
			analytics.track('Signup form submitted', {
				'email': email
			});

			// Check if email is valid
			const domain = email.split('@').pop();
			let validationUrl = "https://6kcbdly0r0.execute-api.us-east-1.amazonaws.com/default/app_check_email_validity?domain=" + domain;

			axios
				.get(validationUrl)
				.then(response => {
					if (response["data"] && response["data"]["is_valid"] === false) {
						showErrorMsg(form, 'danger', "Please use a real email to sign up.");
						analytics.track('Signup form rejected', {
							'email': email,
							'message': "Please use a real email to sign up"
						});
					} else {
						proceedSignup(form, email, password);
					}
				})
				.catch(error => {
					proceedSignup(form, email, password);
				});
			
		});
	}

	var proceedSignup = function(form, email, password) {
		// Submit signup
		var data = {
			first_name: '',
			last_name: '',
			email: email,
			password: password,
			signup_source_data: getSignupSourceData()
		}

		$('#target').html('sending..');

		axios
			.post(`${API_ROOT}/users/`, data)
			.then(response => {

				// Identify user for future events
				var userID = response.data.id;
				analytics.identify(userID);

				authenticateUser(form, data.email, data.password);

			})
			.catch(error => {
				var msg = 'Something went wrong. Please try again.';
				if (error.response && error.response.data.email) {
					msg = `Error: ${error.response.data.email[0]}.`;
				}
				else if (error.response && error.response.data.password) {
					msg = `Error: ${error.response.data.password[0]}.`;
				}
				showErrorMsg(form, 'danger', msg);
			});
	}

	var prefillFields = function () {

		// Prefill email if in URL
		var email = (new URL(window.location.href)).searchParams.get('email');
		if (email) {
			document.getElementById('email').value = email;
		}
	}

	return {
		init: function () {
			if (isAuthenticated()) {
				window.location.replace(APP_URL);
			} else {
				$('body').css('opacity', 1);

				populateLinks();
				handleLoginFormSubmit();
				prefillFields();

				analytics.track('App page loaded - signup', {
					'referrer': document.referrer,
					'current_url': window.location.href,
					'path': window.location.pathname
				});
			}
		}
	};
}();

jQuery(document).ready(function () {
	KTSignUpPage.init();
});
