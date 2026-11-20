"""Candidate UI acceptance; every scheduler destination is intercepted, never booked.

Default: built dist/ served over local HTTP with the generated CSP. --base-url
checks an actual hosted preview without bypassing access controls. These results
do not establish production behavior, GA4 receipt, availability, or appointments.
"""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import re
import shutil
import threading
import time
from urllib.parse import parse_qs, urlencode, urlsplit

from playwright.sync_api import expect, sync_playwright
from scheduling_confirmation_fixture import acknowledge_scheduling_dialog

ROOT = Path(__file__).resolve().parents[1]
COPY = json.loads((ROOT / "content/marketing-improvements.json").read_text())
BOOKING = json.loads((ROOT / "content/simplepractice-booking.json").read_text())
PEOPLE = {p["key"]: p for p in BOOKING["clinicians"]}
ROUTES = list(COPY["routes"])
TRICITIES = "online-therapy-tri-cities-wa"
REQUEST = "https://marriagefamilytherapy.clientsecure.me/request"
PORTAL = "https://marriagefamilytherapy.clientsecure.me/sign-in"
OUT = ROOT / "tmp/marketing-improvements"
ANALYTICS_HOSTS = ("googletagmanager", "google-analytics", "doubleclick", "googlesyndication", "facebook", "segment", "bugsnag", "sentry")
PLACEMENTS = ("primary", "header", "repeated", "footer")
MARKER = 'a[data-marketing-appointment="{}"]'
MOCK = "<!doctype html><title>Intercepted scheduler test</title><h1>Scheduler navigation intercepted</h1><p>No request reached SimplePractice.</p>"


def expected_destination(person=None):
    if not person:
        return REQUEST
    return "https://clientsecure.me/widget-redirect?" + urlencode({
        "scopeId": BOOKING["scopeId"], "applicationId": BOOKING["applicationId"],
        "channel": person.get("channel", "professional_website"),
        "appearance": '{"fullScreen":true}', "clinicianId": person["id"],
    })


def same_destination(actual, expected):
    a, e = urlsplit(actual or ""), urlsplit(expected)
    return (a.scheme, a.netloc, a.path, a.fragment) == (e.scheme, e.netloc, e.path, e.fragment) and parse_qs(a.query) == parse_qs(e.query)


def expected_heading(slug):
    p = COPY["routes"][slug]
    if p.get("title"):
        return p["title"]
    if p.get("clinician"):
        return PEOPLE[p["clinician"]]["name"]
    source = "content/reference-pages/individual.json" if p["kind"] == "individual" else "content/service-guides/marriage-and-couples-therapy-counseling.json"
    return json.loads((ROOT / source).read_text())["hero"]["title"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("MFT_BASE_URL", ""), help="Optional actual preview origin; no authentication bypass")
    args = parser.parse_args()
    hosted = bool(args.base_url)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {
        "environment": "actual hosted preview with mocked scheduler" if hosted else "built candidate on local HTTP with mocked scheduler",
        "checks": [], "scriptErrors": [], "consoleErrors": [], "blockedWrites": [],
        "blockedAnalytics": [], "interceptedHandoffs": [], "pass": False,
        "limits": "All SimplePractice requests are intercepted before reaching the service. No appointment, patient data, email, GA4 collection, or production change. Receipt and confirmed appointments are not tested here.",
    }
    server = None
    browser = None
    current = {"case": "setup", "page": None}
    result_name = "preview-result.json" if hosted else "built-result.json"

    def record(name, action):
        current["case"] = name
        try:
            details = action() or {}
            report["checks"].append({"case": name, "pass": True, **details})
        except Exception as error:
            report["checks"].append({"case": name, "pass": False, "error": str(error)})
            page = current["page"]
            if page and not page.is_closed():
                try:
                    page.screenshot(path=str(OUT / (name + "-failure.png")), timeout=5000)
                except Exception:
                    pass

    def attach(page):
        current["page"] = page
        page.set_default_timeout(10000)
        page.on("pageerror", lambda error: report["scriptErrors"].append({"case": current["case"], "error": str(error)}))
        page.on("console", lambda msg: report["consoleErrors"].append({"case": current["case"], "message": msg.text}) if msg.type == "error" and "Failed to load resource" not in msg.text else None)
        return page

    def make_context(width=390, javascript=True, scenario="declined"):
        context = browser.new_context(viewport={"width": width, "height": 844 if width <= 390 else 1000}, java_script_enabled=javascript, reduced_motion="reduce")
        calls = []

        def guard(route):
            request = route.request
            url = urlsplit(request.url)
            host = url.hostname or ""
            if request.method not in ("GET", "HEAD"):
                report["blockedWrites"].append({"case": current["case"], "host": host, "path": url.path, "method": request.method})
                route.abort()
            elif host == "clientsecure.me" or host.endswith(".clientsecure.me"):
                assert request.is_navigation_request(), "Unexpected scheduler subrequest"
                report["interceptedHandoffs"].append({"case": current["case"], "url": request.url, "method": request.method})
                route.fulfill(status=200, content_type="text/html", body=MOCK)
            elif any(name in host for name in ANALYTICS_HOSTS):
                report["blockedAnalytics"].append({"case": current["case"], "host": host, "path": url.path})
                route.abort()
            elif scenario == "analytics-unavailable" and re.search(r"/mft-(?:analytics|ga4-frame)\.", url.path):
                route.abort()
            elif scenario == "booking-script-failure" and url.path.endswith("/mft-booking.js"):
                calls.append("booking-script-aborted")
                route.abort()
            else:
                route.continue_()

        context.route("**/*", guard)
        # No live analytics opt-in: both current and legacy choices are denied.
        context.add_init_script("try { localStorage.setItem('mft.analytics.consent.v4','denied'); localStorage.setItem('mft.analytics.consent.v2','denied'); } catch {}")
        if scenario == "gpc":
            context.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', {value:true});")
        if scenario == "dnt":
            context.add_init_script("Object.defineProperty(navigator, 'doNotTrack', {value:'1'});")
        if scenario in ("analytics-slow", "measurement-throws"):
            context.expose_function("mftBrowserTestTrack", lambda: calls.append(True))
            behavior = "return new Promise(() => {});" if scenario == "analytics-slow" else "throw new Error('Controlled optional measurement failure');"
            context.add_init_script("window.MFTSchedulingMeasurement={__controlledTest:true,track(){window.mftBrowserTestTrack();" + behavior + "}};")
        return context, calls

    def visit(page, slug):
        response = page.goto(base + "/" + slug + "/", wait_until="domcontentloaded", timeout=30000)
        assert response and response.status == 200, f"{slug}: HTTP {response.status if response else 'no response'}; no preview access bypass attempted"
        assert page.locator("body[data-marketing-candidate]").count() == 1, "Candidate changes absent; this is not the reviewed candidate"
        assert urlsplit(page.url).path == "/" + slug + "/", "Existing route changed"

    def link_check(page, slug):
        p = COPY["routes"][slug]
        person = PEOPLE.get(p.get("clinician"))
        expected = expected_destination(person)
        for placement in (*PLACEMENTS, "footer-utility"):
            a = page.locator(MARKER.format(placement))
            assert a.count() == 1, f"Expected one {placement} action on {slug}"
            assert a.inner_text().strip() == p["primary"], (slug, placement, "action label")
            assert same_destination(a.get_attribute("href"), expected), (slug, placement, a.get_attribute("href"))
            assert a.get_attribute("data-spwidget-clinician-id") == (person["id"] if person else None)
            assert a.get_attribute("target") in (None, "", "_self"), "Popup dependency introduced"
            assert a.get_attribute("data-mft-booking-intent") == ("consultation" if p["kind"] == "couples" else "appointment")
            assert a.locator("xpath=ancestor::a").count() == 0, "Nested scheduling anchor"
            described = (a.get_attribute("aria-describedby") or "").split()
            assert described and all(page.locator("[id=" + json.dumps(id_) + "]").count() == 1 for id_ in described), "Unresolved accessible instructions"
        utility_request = page.locator('.site-footer a[data-mft-booking-utility="request"]')
        assert utility_request.count() == 1 and utility_request.get_attribute("data-marketing-appointment") == "footer-utility", "Footer utility request does not preserve this page's scheduling path"
        utility_portal = page.locator('.site-footer a[data-mft-booking-utility="portal"]')
        assert utility_portal.count() == 1 and utility_portal.get_attribute("href") == PORTAL, "Footer utility portal must open sign-in"
        assert utility_portal.get_attribute("data-mft-existing-client") == "true"
        assert utility_portal.get_attribute("data-mft-booking-intent") is None and utility_portal.get_attribute("data-spwidget-clinician-id") is None, "Footer sign-in must remain independent of new-client scheduling"
        existing = page.locator("a[data-mft-existing-client]")
        assert existing.count() >= 2, "Returning-client access absent"
        for a in existing.all():
            assert a.get_attribute("href") == PORTAL
            assert a.get_attribute("data-mft-booking") is None, "Returning client misclassified as new appointment"
        if slug == TRICITIES:
            for key in COPY["routes"][slug]["profileKeys"]:
                a = page.locator(f'a[data-marketing-appointment="clinician"][data-mft-clinician="{key}"]')
                assert a.count() == 1 and same_destination(a.get_attribute("href"), expected_destination(PEOPLE[key]))
        if slug == "new-page":
            evaluation = page.locator('#starting-options a[data-mft-booking-intent="appointment"]')
            assert evaluation.count() == 1 and evaluation.get_attribute("href") == REQUEST, "Diagnostic evaluation card still routes to the portal homepage"

    def handoff(page, slug, selector, expected, before_click=None):
        visit(page, slug)
        if before_click:
            before_click()
        a = page.locator(selector)
        if not a.is_visible() and '"header"' in selector:
            page.locator(".menu-button").click()
        before = len(report["interceptedHandoffs"])
        a.click(timeout=10000)
        go = acknowledge_scheduling_dialog(page)
        if expected == PORTAL:
            assert go is None, "Returning-client sign-in must bypass confirmation"
        elif go is not None:
            assert same_destination(go.get_attribute("href"), expected), "Confirmation changed the scheduler destination"
            go.click()
        page.get_by_role("heading", name="Scheduler navigation intercepted").wait_for(timeout=5000)
        assert same_destination(page.url, expected), (slug, selector, page.url)
        assert len(report["interceptedHandoffs"]) == before + 1, "Missing or duplicate scheduler navigation"
        assert len(page.context.pages) == 1, "Unexpected popup"

    try:
        if hosted:
            parsed = urlsplit(args.base_url)
            assert parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment, "Provide an HTTPS preview origin without credentials or tokens"
            base = args.base_url.rstrip("/")
        else:
            headers = (ROOT / "dist/_headers").read_text()
            csp = re.search(r"Content-Security-Policy: ([^\n]+)", headers)

            class Handler(http.server.SimpleHTTPRequestHandler):
                def log_message(self, *_args):
                    pass

                def end_headers(self):
                    self.send_header("Referrer-Policy", "no-referrer")
                    if csp:
                        self.send_header("Content-Security-Policy", csp[1])
                    super().end_headers()

            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT / "dist")))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            base = "http://127.0.0.1:" + str(server.server_port)
        report["baseUrl"] = base
        executable = os.environ.get("CHROME_PATH") or shutil.which("google-chrome") or shutil.which("chromium")
        if not executable:
            raise RuntimeError("No installed Chrome executable; set CHROME_PATH")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=executable, headless=True, args=["--no-sandbox"])
            for width in (1440, 768, 390, 320):
                context, _ = make_context(width)
                page = attach(context.new_page())
                for slug in ROUTES:
                    def layout(slug=slug, width=width):
                        visit(page, slug)
                        assert page.locator("h1").count() == 1 and page.locator("main").count() == 1
                        assert page.locator("h1").inner_text().strip() == expected_heading(slug)
                        # Canonicals identify Netlify's final directory URL, not
                        # the slashless request that redirects to it.
                        assert page.locator('link[rel="canonical"]').get_attribute("href") == "https://www.mft.care/" + slug + "/"
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"Horizontal overflow at {width}px"
                        link_check(page, slug)
                        primary = page.locator(MARKER.format("primary"))
                        box = primary.bounding_box()
                        if slug == TRICITIES and width == 390:
                            assert box and box["y"] >= 0 and box["y"] + box["height"] <= 844, f"Tri-Cities primary action is below the first mobile screen: {box}"
                            assert page.locator(".mft-schedule-shortcuts").count() == 0
                        primary.focus()
                        page.keyboard.press("Tab")
                        page.keyboard.press("Shift+Tab")
                        expect(primary).to_be_focused()
                        assert primary.evaluate("el => { const s=getComputedStyle(el); return el.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; }"), "Keyboard focus indicator absent"
                        if width in (1440, 390):
                            # Preserve the real keyboard-focus view, then return to
                            # the top before full-page capture. A focused control
                            # below the first viewport scrolls the page; capturing
                            # there makes sticky/fixed chrome appear mid-document.
                            page.screenshot(path=str(OUT / (slug + "-" + str(width) + "-focus.png")))
                            page.evaluate("window.scrollTo({top: 0, left: 0, behavior: 'instant'})")
                            page.wait_for_function("window.scrollY === 0")
                            page.screenshot(path=str(OUT / (slug + "-" + str(width) + ".png")), full_page=True)
                        return {"route": "/" + slug + "/", "width": width, "primaryBox": box, "focusVisible": True}
                    record("layout-" + str(width) + "-" + slug, layout)
                context.close()

            for width in (1440, 390):
                context, _ = make_context(width)
                page = attach(context.new_page())
                for slug in ROUTES:
                    person = PEOPLE.get(COPY["routes"][slug].get("clinician"))
                    for placement in PLACEMENTS:
                        record("handoff-" + str(width) + "-" + slug + "-" + placement,
                               lambda slug=slug, placement=placement, person=person: handoff(page, slug, MARKER.format(placement), expected_destination(person)))
                    record("returning-" + str(width) + "-" + slug,
                           lambda slug=slug: handoff(page, slug, '.marketing-returning a[data-mft-existing-client]', PORTAL))
                    record("utility-request-" + str(width) + "-" + slug,
                           lambda slug=slug, person=person: handoff(page, slug, '.site-footer a[data-mft-booking-utility="request"]', expected_destination(person)))
                    record("utility-portal-" + str(width) + "-" + slug,
                           lambda slug=slug: handoff(page, slug, '.site-footer a[data-mft-booking-utility="portal"]', PORTAL))
                for key in COPY["routes"][TRICITIES]["profileKeys"]:
                    record("card-" + str(width) + "-" + key,
                           lambda key=key: handoff(page, TRICITIES, f'a[data-marketing-appointment="clinician"][data-mft-clinician="{key}"]', expected_destination(PEOPLE[key])))

                def consultation():
                    visit(page, TRICITIES)
                    a = page.get_by_role("link", name="Request a Free 10-minute Phone Consultation", exact=True)
                    count = len(report["interceptedHandoffs"])
                    a.click()
                    dialog = page.locator("dialog.mft-consultation-gate")
                    expect(dialog).to_be_visible()
                    go = dialog.locator("[data-consultation-continue]")
                    assert go.get_attribute("href") is None and go.get_attribute("aria-disabled") == "true"
                    dialog.get_by_role("button", name="Cancel", exact=True).click()
                    expect(dialog).not_to_be_visible()
                    expect(a).to_be_focused()
                    assert len(report["interceptedHandoffs"]) == count and urlsplit(page.url).path == "/" + TRICITIES + "/"
                    a.click()
                    page.keyboard.press("Escape")
                    expect(dialog).not_to_be_visible()
                    assert len(report["interceptedHandoffs"]) == count
                    a.click()
                    go = acknowledge_scheduling_dialog(page)
                    assert go is not None
                    assert go.get_attribute("href") == REQUEST and go.get_attribute("aria-disabled") == "false"
                    go.click()
                    page.get_by_role("heading", name="Scheduler navigation intercepted").wait_for()
                    assert same_destination(page.url, REQUEST) and len(report["interceptedHandoffs"]) == count + 1
                    return {"cancelHandoffs": 0, "escapeHandoffs": 0, "continueHandoffs": 1}
                record("consultation-" + str(width), consultation)
                context.close()

            for scenario in ("declined", "gpc", "dnt", "analytics-unavailable", "analytics-slow", "measurement-throws", "booking-script-failure", "no-javascript"):
                context, calls = make_context(390, javascript=scenario != "no-javascript", scenario=scenario)
                page = attach(context.new_page())
                for slug in ROUTES:
                    def resilient(slug=slug, scenario=scenario):
                        before = len(calls)
                        person = PEOPLE.get(COPY["routes"][slug].get("clinician"))
                        def preflight():
                            if scenario == "no-javascript":
                                link_check(page, slug)
                            elif scenario == "gpc":
                                assert page.evaluate("navigator.globalPrivacyControl === true")
                            elif scenario == "dnt":
                                assert page.evaluate("navigator.doNotTrack === '1'")
                            elif scenario == "analytics-unavailable":
                                assert page.evaluate("window.MFTSchedulingMeasurement == null")
                            elif scenario in ("analytics-slow", "measurement-throws"):
                                assert page.evaluate("window.MFTSchedulingMeasurement?.__controlledTest === true")
                        handoff(page, slug, MARKER.format("primary"), expected_destination(person), preflight)
                        if scenario in ("analytics-slow", "measurement-throws", "booking-script-failure"):
                            assert len(calls) > before, "Controlled latency/failure condition was not exercised"
                        return {"route": "/" + slug + "/", "scenario": scenario, "schedulerMocked": True}
                    record("resilience-" + scenario + "-" + slug, resilient)
                context.close()
            browser.close()
            browser = None
        assert not report["scriptErrors"], "Unexpected JavaScript errors; see report"
        assert not report["consoleErrors"], "Unexpected browser console errors; see report"
        assert not report["blockedWrites"], "Unexpected attempted writes; see report"
        assert all(c["pass"] for c in report["checks"]), "Browser acceptance cases failed; see report"
        report["pass"] = True
    except Exception as error:
        report["error"] = str(error)
    finally:
        if server:
            server.shutdown()
        report["checkedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (OUT / result_name).write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"environment": report["environment"], "pass": report["pass"], "passed": sum(c["pass"] for c in report["checks"]), "total": len(report["checks"]), "failures": [c for c in report["checks"] if not c["pass"]], "error": report.get("error")}, indent=2))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
