"""Regression checks for detached-frame interception and complete-payload gates."""
import base64
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('harness', Path(__file__).with_name('scheduling-browser-harness.py'))
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


class Session:
    def __init__(self):
        self.calls = []
        self.listeners = {}

    def on(self, name, handler):
        self.listeners[name] = handler

    def send(self, name, payload):
        self.calls.append((name, payload))


class Browser:
    def __init__(self):
        self.session = Session()

    def new_browser_cdp_session(self):
        return self.session


def collector(body=None, has_body=False):
    request = {'url': 'https://www.google-analytics.com/g/collect?tid=synthetic',
               'method': 'POST', 'headers': {'Content-Type': 'text/plain'}, 'hasPostData': has_body}
    if body is not None:
        request['postData'] = body
    # Deliberately no frameId or networkId: the old observer discarded this case.
    return {'requestId': 'detached-1', 'request': request, 'resourceType': 'Ping'}


class HarnessTests(unittest.TestCase):
    def test_detached_request_preserves_entire_batch_and_is_fulfilled_once(self):
        browser = Browser()
        observed = []

        def guard(route):
            observed.append(route.request.post_data)
            self.assertEqual(route.request.headers['content-type'], 'text/plain')
            route.fulfill(status=204)

        interceptor = harness.install_browser_interceptor(browser, guard)
        body = 'en=consultation_click\nen=simplepractice_exit&ep.button_location=dialog'
        browser.session.listeners['Fetch.requestPaused'](collector(body, True))
        interceptor.assert_ok()
        self.assertEqual(observed, [body])
        self.assertEqual([name for name, _ in browser.session.calls], ['Fetch.enable', 'Fetch.fulfillRequest'])

    def test_missing_post_body_aborts_without_calling_payload_validator(self):
        browser = Browser()
        observed = []
        interceptor = harness.install_browser_interceptor(browser, lambda route: observed.append(route.request))
        browser.session.listeners['Fetch.requestPaused'](collector(has_body=True))
        self.assertEqual(observed, [])
        self.assertEqual(browser.session.calls[-1][0], 'Fetch.failRequest')
        with self.assertRaisesRegex(AssertionError, 'omitted a request body'):
            interceptor.assert_ok()

    def test_complete_binary_entries_are_decoded_and_partial_entries_fail(self):
        event = collector(has_body=True)
        event['request']['postDataEntries'] = [{'bytes': base64.b64encode(b'en=simplepractice_exit').decode()}]
        self.assertEqual(harness.BrowserRequest(event).post_data, 'en=simplepractice_exit')
        event['request']['postDataEntries'].append({})
        with self.assertRaisesRegex(AssertionError, 'omitted part'):
            harness.BrowserRequest(event)

    def test_guard_assertion_fails_closed_and_remains_a_failed_gate(self):
        browser = Browser()

        def guard(route):
            raise AssertionError('Synthetic privacy violation')

        interceptor = harness.install_browser_interceptor(browser, guard)
        browser.session.listeners['Fetch.requestPaused'](collector())
        self.assertEqual(browser.session.calls[-1][0], 'Fetch.failRequest')
        with self.assertRaisesRegex(AssertionError, 'Synthetic privacy violation'):
            interceptor.assert_ok()

    def test_canceled_decorative_resource_is_recorded_but_canceled_collector_still_fails(self):
        def reject_fulfillment(name, payload):
            if name == 'Fetch.fulfillRequest':
                raise RuntimeError('CDPSession.send: Protocol error (Fetch.fulfillRequest): Invalid InterceptionId.')

        browser = Browser()
        browser.session.send = reject_fulfillment
        interceptor = harness.install_browser_interceptor(browser, lambda route: route.fulfill(status=204))
        image = {'requestId': 'image-1', 'resourceType': 'Image',
                 'request': {'url': 'https://www.mft.care/assets/synthetic.webp', 'method': 'GET'}}
        browser.session.listeners['Fetch.requestPaused'](image)
        interceptor.assert_ok()
        self.assertEqual(len(interceptor.cancelled_resources), 1)
        browser.session.listeners['Fetch.requestPaused'](collector('en=simplepractice_exit', True))
        with self.assertRaisesRegex(AssertionError, 'Invalid InterceptionId'):
            interceptor.assert_ok()

    def test_canceled_scripts_documents_and_post_requests_remain_failed_gates(self):
        for resource_type, path, method in [('Script', '/assets/mft-analytics.js', 'GET'), ('Document', '/', 'GET'), ('Image', '/assets/synthetic.webp', 'POST')]:
            with self.subTest(resource_type=resource_type):
                browser = Browser()

                def reject_fulfillment(name, payload):
                    if name == 'Fetch.fulfillRequest':
                        raise RuntimeError('CDPSession.send: Protocol error (Fetch.fulfillRequest): Invalid InterceptionId.')

                browser.session.send = reject_fulfillment
                interceptor = harness.install_browser_interceptor(browser, lambda route: route.fulfill(status=200))
                event = {'requestId': 'critical-1', 'resourceType': resource_type,
                         'request': {'url': 'https://www.mft.care' + path, 'method': method}}
                browser.session.listeners['Fetch.requestPaused'](event)
                self.assertEqual(interceptor.cancelled_resources, [])
                with self.assertRaisesRegex(AssertionError, 'Invalid InterceptionId'):
                    interceptor.assert_ok()


if __name__ == '__main__':
    unittest.main()
