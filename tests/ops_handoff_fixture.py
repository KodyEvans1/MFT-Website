"""Strict synthetic receiver for the reviewed first-party handoff envelope.

This validates browser output only. It never contacts Ops or verifies a real
SimplePractice request; the actual ingestion/database tests remain separate.
"""
import json
import re
import uuid
from urllib.parse import urlsplit

ENDPOINT = 'https://ops.mft.care/api/marketing/attribution'
CAMPAIGNS = {'24274542446', '24362234053', '24435101888', '24444626634', '24449945489', '24530528782', '24524392745'}
REQUIRED = {'schemaVersion', 'eventType', 'eventId', 'occurredAt', 'consentVersion', 'source', 'medium', 'pageCode', 'placement'}
PAIRS = {'google/cpc', 'google/organic', 'bing/organic', 'direct/none', 'referral/referral', 'other/unknown', 'unknown/unknown'}


def is_handoff_request(request):
    url = urlsplit(request.url)
    return url.scheme == 'https' and url.netloc == 'ops.mft.care' and url.path == '/api/marketing/attribution' and not url.query


def validate_handoff(request):
    assert is_handoff_request(request), 'Unexpected internal collector destination'
    assert request.method == 'POST', 'Internal collector receives POST only'
    assert request.post_data, 'Missing complete handoff body'
    body = json.loads(request.post_data)
    assert REQUIRED <= set(body) <= REQUIRED | {'campaignId'}, ('Unexpected envelope fields', sorted(body))
    assert body['schemaVersion'] == 1 and body['eventType'] == 'simplepractice_exit'
    assert body['consentVersion'] == 'mft.analytics.consent.v4'
    assert str(uuid.UUID(body['eventId'], version=4)) == body['eventId'] and uuid.UUID(body['eventId']).version == 4
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', body['occurredAt'])
    assert body['source'] + '/' + body['medium'] in PAIRS
    if 'campaignId' in body:
        assert body['source'] == 'google' and body['medium'] == 'cpc' and body['campaignId'] in CAMPAIGNS
    assert re.fullmatch(r'[a-f0-9]{16}', body['pageCode'])
    assert body['placement'] in {'header', 'footer', 'body', 'dialog'}
    assert not request.headers.get('referer') and not request.headers.get('cookie') and not request.headers.get('authorization')
    assert request.headers.get('content-type', '').lower().startswith('text/plain')
    raw = request.post_data.lower()
    for forbidden in ['private-canary', 'example.invalid', 'secret-click', 'clinicianid', 'link_url', 'utm_adgroup_id', 'utm_creative_id', 'gclid', 'gbraid', 'wbraid', '202031516078', '701234567890']:
        assert forbidden not in raw, ('Disallowed first-party field', forbidden)
    return body


def accept_handoff(route, status=202):
    route.fulfill(status=status, body=json.dumps({'ok': status < 400}), headers={
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://www.mft.care',
        'Cache-Control': 'no-store',
    })
