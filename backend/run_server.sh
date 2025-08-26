#!/bin/bash

# Navigate to the backend directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Run the server
python3 main.py
