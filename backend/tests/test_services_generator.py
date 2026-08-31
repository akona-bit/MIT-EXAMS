import inspect

from app.services import generator


def test_generator_module_has_expected_functions():
    assert hasattr(generator, "generate_original_exam"), "generate_original_exam missing"
    assert hasattr(generator, "generate_shuffled_forms"), "generate_shuffled_forms missing"

    # Both should be async functions
    assert inspect.iscoroutinefunction(generator.generate_original_exam)
    assert inspect.iscoroutinefunction(generator.generate_shuffled_forms)
