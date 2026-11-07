"""Exercise batch publishing without a GPU, credentials, or external services."""
import ast, base64, copy, json, os, unittest
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlparse

NOTEBOOK = Path(__file__).resolve().parents[1] / 'public' / 'Simmer_Cloud_Photos_Batch.ipynb'
nb = json.loads(NOTEBOOK.read_text())
namespace = {'urlparse': urlparse, 'os': os, 'Generation': lambda prompt, seed, steps: SimpleNamespace(prompt=prompt, seed=seed, steps=steps)}
for cell in nb['cells']:
    if cell['cell_type'] != 'code':
        continue
    source = ''.join(cell['source'])
    compile(source, '<notebook>', 'exec')
    tree = ast.parse(source)
    if any(isinstance(node, ast.FunctionDef) and node.name == 'needs_photo' for node in tree.body):
        body = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'needs_photo']
        exec(compile(ast.Module(body=body, type_ignores=[]), '<needs-photo>', 'exec'), namespace)
    if 'def run_photo_batch(' in source:
        exec(compile(source, '<publisher>', 'exec'), namespace)
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ0AAAAASUVORK5CYII=')

def recipe(name, seed=1):
    return {'id': name, 'name': name, 'description': 'A cooked meal', 'ingredients': [{'name': 'rice', 'amount': 100, 'unit': 'g'}], 'steps': ['Cook rice.'], 'image': 'old.jpg', 'imageGenerated': False, 'generation': {'prompt': name + ' with rice', 'recipeHash': name, 'seed': seed}}

class Collection:
    def __init__(self, values):
        self.values = {r['id']: copy.deepcopy(r) for r in values}
    def find_one(self, query):
        return copy.deepcopy(self.values.get(query['id']))
    def update_one(self, guard, update, upsert=False):
        assert not upsert
        current = self.values[guard['id']]
        matched = all(current.get(key) == value for key, value in guard.items())
        if matched:
            current.update(update['$set'])
        return SimpleNamespace(matched_count=int(matched))

class Engine:
    def __init__(self): self.calls = []
    def generate(self, request):
        self.calls.append(request)
        return PNG

def upload(*args, **kwargs):
    return {'secure_url': 'https://example.test/' + kwargs['public_id'] + '.png', 'public_id': kwargs['public_id']}

class BatchTests(unittest.TestCase):
    def test_generates_distinct_requests_and_resumes_without_duplicates(self):
        values = [recipe('toast', 10), recipe('pasta', 20), recipe('salad', 30)]
        values[1].update(imageGenerated=True, image='https://example.test/reviewed.png')
        db, engine = Collection(values), Engine()
        result = namespace['run_photo_batch'](values, engine, db, upload, lambda *_a, **_k: None)
        self.assertEqual(result['saved'], ['toast', 'salad'])
        self.assertEqual(result['skipped'], 1)
        self.assertEqual([call.seed for call in engine.calls], [10, 30])
        rerun = namespace['run_photo_batch'](values, engine, db, upload, lambda *_a, **_k: None)
        self.assertEqual(rerun['saved'], [])
        self.assertEqual(rerun['skipped'], 3)
        self.assertEqual(len(engine.calls), 2)
    def test_failed_generation_keeps_existing_photo(self):
        value = recipe('toast')
        class FailedEngine:
            def generate(self, _request): raise ValueError('not an image')
        db = Collection([value])
        result = namespace['run_photo_batch']([value], FailedEngine(), db, upload, lambda *_a, **_k: None)
        self.assertEqual(len(result['failed']), 1)
        self.assertEqual(db.values['toast']['image'], 'old.jpg')
        self.assertFalse(db.values['toast']['imageGenerated'])
    def test_concurrent_recipe_edits_are_preserved(self):
        value = recipe('toast'); db = Collection([value]); db.values['toast']['ingredients'].append({'name': 'avocado', 'amount': 1, 'unit': ''})
        with self.assertRaisesRegex(ValueError, 'recipe changed'):
            namespace['publish_generated_photo'](value, PNG, db, upload, lambda *_a, **_k: None)
        self.assertEqual(db.values['toast']['image'], 'old.jpg')
    def test_late_photo_change_does_not_publish_or_keep_orphan_upload(self):
        value = recipe('toast'); db = Collection([value]); destroyed = []
        def concurrent_upload(*args, **kwargs):
            db.values['toast']['image'] = 'newer.jpg'
            return upload(*args, **kwargs)
        with self.assertRaisesRegex(ValueError, 'newer version was kept'):
            namespace['publish_generated_photo'](value, PNG, db, concurrent_upload, lambda asset, **_kw: destroyed.append(asset))
        self.assertEqual(db.values['toast']['image'], 'newer.jpg')
        self.assertEqual(len(destroyed), 1)
    def test_changed_recipe_key_requests_a_new_photo(self):
        value = recipe('toast'); value.update(imageGenerated=True, imageRecipeHash='older-key')
        self.assertTrue(namespace['needs_photo'](value))
        value['imageRecipeHash'] = value['generation']['recipeHash']
        self.assertFalse(namespace['needs_photo'](value))

if __name__ == '__main__': unittest.main()
