# omnibin
DTI531 Midterm & Final Project. Waste Sorting Bin Web App

![omnibinLogo](/misc/logo.svg)

## What
Initially inspired by [PlasTell](https://www.matoha.com/plastics-identification), I wanted to develop a material identification device, specifically plastic types using NIR Spectroscopy. This is not the most feasible for a webapp or scope of this project because of the technology/sensors required to preform plastic identification. 

Instead, OmniBin, was developed as a play on the currently available [[Bin•E](https://www.bine.world/), [Ameru](https://www.ameru.ai/), and [CleanRobotics](https://www.waste360.com/fleet-technology/one-pittsburgh-based-tech-company-has-developed-a-self-sorting-trash-bin)] focusing on general waste sorting.

This bin will be powered by a Raspberry Pi, with the addition of a camera and servo motor. The camera will automatically take a snapshot of the item in its resovoir, run the ML model and identify the item, prompt the user with the classification and their verification, and send the data to a database for future application.

## Why
In the US many people don't sort waste correctly, not just because they don't care but because of confusion. 
Uncertainty:
- Is this plastic recyclable?
- Is this contaminated?
- Will these all go into the same bin later? Does it matter?

Even if bins are labeled, contamination is high. We've all seen these, even around Duke University's campus:
![trash bin separator](https://thetigercu.com/wp-content/uploads/2025/12/IMG_5013-1200x900.jpg)

OmniBin, takes all waste - hence the name, and automatically identifies and sorts it for the user.

OmniBin plans to be established in high trash volume spaces like universities and offices, especially ones that have waste stream management systems in place.

Downstream, this aims to help the processing plant and recycling facility –– reducing the need for material separation and contamination management.

## How
### Flowchart
```
User
  ↓
Webcam Capture
  ↓
Local ML Model (classification) [Teachable Machine Model via Tensorflow]
  ↓
User Confirmation (user input)
  ↓
Backend API
  ↓
    -> (1) Store in MongoDB (POST Request)
    -> (2) Trigger Servo Logic (MQTT)
  ↓
Simulated Mechanical Action (MQTT)
```
### ML
Using [Teachable Machine](https://teachablemachine.withgoogle.com/train/image) I developed an image identification model.

### Database
The database used to train it: [RealWaste](https://www.kaggle.com/datasets/joebeachcapital/realwaste/data)

### Dependencies
**Teachable Machine**
`https://cdn.jsdelivr.net/npm/@teachablemachine/image/dist/teachablemachine-image.min.js`

`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js`

**Packages**
```
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^17.3.1",
    "express": "^4.18.2",
    "mongodb": "^6.3.0"
  }
```

### Future
- If incorrect, allow the user to input the actual classification
- If incorrect, simulate the motor movement based on user input
- Deploy on Vercel, convert from Express to serverless function
- Create a loop to train the model from data stored in MongoDB
- Run on raspberry pi with real servo motors that move the waste into specified bins

## End-to-End Use
![using](/misc/Using.png)

![mqtt](/misc/mqtt.png)

## Extra Info
**Initial System Diagram**

![systemdiagram](/misc/system.drawio.png)

**Vocab**

![teachablemachinevocab](/misc/tm_vocab.png)

**Model Accuracy By Category/Class**

![accuracy](/misc/tm_accuracy.png)

**More Info**

![perepoch](/misc/tm_accuracy-per-epoch.png)
![confusionmatrix](/misc/tm_confusion-matrix.png)
![lossperepoch](/misc/tm_loss-per-epoch.png)
