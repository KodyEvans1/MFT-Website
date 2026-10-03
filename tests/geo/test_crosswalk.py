import importlib.util
from pathlib import Path
import unittest
from shapely.geometry import box, mapping, Polygon
spec = importlib.util.spec_from_file_location('crosswalk', Path(__file__).resolve().parents[2] / 'scripts/geo/county_crosswalk.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class CountyCrosswalkTests(unittest.TestCase):
    def test_border_touch_is_not_membership(self):
        self.assertEqual(m.memberships(box(0,0,1,1), [('53001',box(0,0,1,1)),('53003',box(1,0,2,1))]), (['53001'], []))
    def test_two_and_three_county_places_keep_all_parents(self):
        counties = [('53001',box(0,0,1,1)),('53003',box(1,0,2,1)),('53005',box(2,0,3,1))]
        self.assertEqual(m.memberships(box(.5,0,2.5,1), counties)[0], ['53001','53003','53005'])
        self.assertEqual(m.memberships(box(.5,0,1.5,1), counties)[0], ['53001','53003'])
    def test_missing_coverage_fails(self):
        with self.assertRaises(ValueError): m.memberships(box(0,0,2,1), [('53001',box(0,0,1,1))])
    def test_tiny_overlaps_are_disclosed(self):
        self.assertEqual(m.memberships(box(0,0,1,1), [('53001',box(0,0,1,1)),('53003',box(1-1e-8,0,2,1))]), (['53001'],['53003']))
    def test_invalid_geometry_is_not_silently_repaired(self):
        with self.assertRaises(ValueError): m.polygon({'geometry': mapping(box(0,0,0,0))})
    def test_ring_normalization_requires_an_explicit_audit(self):
        ring = Polygon([(0,0),(1,0),(1,1),(2,1),(2,2),(1,2),(1,1),(0,1),(0,0)])
        feature = {'geometry': mapping(ring), 'properties': {'GEOID':'5300000'}}
        with self.assertRaises(ValueError): m.polygon(feature)
        audit=[]
        fixed=m.polygon(feature,audit)
        self.assertTrue(fixed.is_valid)
        self.assertEqual(fixed.area,ring.area)
        self.assertEqual(audit[0]['geoid'],'5300000')
if __name__ == '__main__': unittest.main()
