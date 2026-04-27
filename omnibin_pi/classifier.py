import numpy as np
from PIL import Image
import tflite_runtime.interpreter as tflite


class WasteClassifier:
    def __init__(self, model_path='model/model.tflite',
                 labels_path='model/labels.txt'):
        self.interpreter = tflite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

        # Model expects 224x224 (from your metadata.json)
        self.input_size = (224, 224)

        with open(labels_path, 'r') as f:
            self.labels = [line.strip() for line in f.readlines()]

        print(f"[CLASSIFIER] Loaded model. Labels: {self.labels}")

    def preprocess(self, frame_rgb):
        """Resize and normalize frame for model input."""
        img = Image.fromarray(frame_rgb).resize(self.input_size)
        img_array = np.array(img, dtype=np.float32)
        # Normalize to [0, 1] — Teachable Machine MobileNet expects this
        img_array = img_array / 255.0
        # Add batch dimension
        return np.expand_dims(img_array, axis=0)
    '''
    def predict(self, frame_rgb):
        """
        Run inference on an RGB frame.
        Returns list of dicts: [{'label': str, 'confidence': float}, ...]
        sorted by confidence descending.
        """
        input_data = self.preprocess(frame_rgb)

        self.interpreter.set_tensor(
            self.input_details[0]['index'], input_data
        )
        self.interpreter.invoke()

        output_data = self.interpreter.get_tensor(
            self.output_details[0]['index']
        )[0]

        results = [
            {'label': self.labels[i], 'confidence': float(output_data[i])}
            for i in range(len(self.labels))
        ]
        results.sort(key=lambda x: x['confidence'], reverse=True)
        return results
    '''

    def predict(self, frame_rgb):
        input_data = self.preprocess(frame_rgb)

        self.interpreter.set_tensor(
            self.input_details[0]['index'], input_data
        )
        self.interpreter.invoke()

        # Get raw output and flatten safely regardless of shape
        raw = self.interpreter.get_tensor(self.output_details[0]['index'])
        output_data = np.squeeze(raw).tolist()

        # Handle edge case where only 1 label exists (scalar output)
        if not isinstance(output_data, list):
            output_data = [output_data]

        results = [
            {'label': self.labels[i], 'confidence': float(output_data[i])}
            for i in range(len(self.labels))
        ]
        results.sort(key=lambda x: x['confidence'], reverse=True)
        return results


    def predict_top(self, frame_rgb, threshold=0.6):
        """
        Return top prediction only if confidence >= threshold.
        Returns dict or None if below threshold.
        """
        results = self.predict(frame_rgb)
        top = results[0]
        if top['confidence'] >= threshold:
            return top
        return None
