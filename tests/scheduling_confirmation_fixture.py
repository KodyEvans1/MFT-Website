"""Complete visible scheduling acknowledgments without skipping the public flow."""
from playwright.sync_api import expect


def acknowledge_scheduling_dialog(page):
    """Return the enabled native Continue, or None when no dialog is required.

    Deliberately do not click Continue: callers retain their navigation, timing,
    destination and measurement assertions. No localStorage preference is seeded.
    """
    dialog = page.locator('dialog.mft-consultation-gate[open]')
    if not dialog.count() or not dialog.is_visible():
        return None
    assert dialog.count() == 1, 'More than one scheduling dialog is open'
    visible = 0
    for selector in ['[data-mft-account-ack]', '[data-mft-consultation-ack]']:
        checkbox = dialog.locator(selector)
        if checkbox.count() and checkbox.is_visible():
            visible += 1
            checkbox.check()
    assert visible, 'An open scheduling dialog has no supported acknowledgment'
    go = dialog.locator('[data-consultation-continue]')
    expect(go).to_be_enabled()
    assert go.get_attribute('href'), 'Enabled Continue must retain a real native URL'
    return go
