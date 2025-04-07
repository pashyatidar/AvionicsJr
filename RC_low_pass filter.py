import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# RC Filter Functions
first = [0.0] * 5  # One for each channel: pressure, acc_x, acc_y, acc_z, acc_tot

def rc_filter_coefficients(cutoff_freq_hz, sample_time_s):
    """
    Compute RC filter coefficients.
    Args:
        cutoff_freq_hz (float): Cutoff frequency in Hz
        sample_time_s (float): Sample time in seconds
    Returns:
        list: [high-pass coefficient, low-pass coefficient]
    """
    RC = 1.0 / (2 * np.pi * cutoff_freq_hz)
    coeff = [0.0, 0.0]
    coeff[0] = sample_time_s / (sample_time_s + RC)  # High-pass coefficient
    coeff[1] = RC / (sample_time_s + RC)  # Low-pass coefficient
    return coeff

def rc_filter_update(coeff, inp, channel):
    """
    Apply the RC filter to an input value.
    Args:
        coeff (list): Filter coefficients [high-pass, low-pass]
        inp (float): Input value to filter
        channel (int): Index of the channel (0 for pressure, 1-3 for accel, 4 for acc_tot)
    Returns:
        float: Filtered output value
    """
    global first
    out = coeff[0] * inp + coeff[1] * first[channel]
    first[channel] = out
    return out

# Read the dataset
dataset_path = r"C:\Users\yashp\Downloads\no_hopes.csv"
try:
    data = pd.read_csv(dataset_path)
except FileNotFoundError:
    print(f"Error: The file '{dataset_path}' was not found. Please check the path and try again.")
    exit(1)

# Ensure the dataset has the expected columns
expected_columns = ['time', 'pressure', 'acc_x', 'acc_y', 'acc_z', 'acc_tot']
if not all(col in data.columns for col in expected_columns):
    missing_cols = [col for col in expected_columns if col not in data.columns]
    raise ValueError(f"Dataset is missing the following required columns: {', '.join(missing_cols)}")

# Check for non-numeric data and convert to numeric, handling errors
for col in expected_columns:
    data[col] = pd.to_numeric(data[col], errors='coerce')
    if data[col].isna().any():
        print(f"Warning: Column '{col}' contains non-numeric values or NaNs. These will be dropped.")

# Drop rows with NaN values
data = data.dropna()
if data.empty:
    raise ValueError("Dataset is empty after dropping rows with NaN values. Please check your data.")

# Compute the sample time (average time difference between timestamps)
time_diffs = data['time'].diff().dropna()  # Differences between consecutive timestamps
sample_time_s = time_diffs.mean()  # Average sample time in seconds
if sample_time_s <= 0:
    raise ValueError("Computed sample time is zero or negative. Check the 'time' column in your dataset.")
print(f"Average sample time: {sample_time_s:.6f} seconds")

# Define the cutoff frequency for the RC filter
cutoff_freq_hz = 1.0  # Adjust as needed
if cutoff_freq_hz <= 0:
    raise ValueError("Cutoff frequency must be positive.")
coeff = rc_filter_coefficients(cutoff_freq_hz, sample_time_s)
print(f"Filter coefficients: High-pass = {coeff[0]:.6f}, Low-pass = {coeff[1]:.6f}")

# Apply the RC filter to each column
channels = ['pressure', 'acc_x', 'acc_y', 'acc_z', 'acc_tot']
filtered_data = data.copy()

for i, channel in enumerate(channels):
    # Reset the filter state for each channel
    first[i] = 0.0
    # Apply the filter to the entire column
    filtered_data[channel] = [rc_filter_update(coeff, val, i) for val in data[channel]]

# Save the filtered data to a new CSV file
output_path = 'filtered_dataset.csv'
filtered_data.to_csv(output_path, index=False)
print(f"Filtered data saved to '{output_path}'")

# Plot the original and filtered data for all channels
for channel in channels:
    plt.figure(figsize=(10, 6))
    plt.plot(data['time'], data[channel], label=f'Original {channel}', alpha=0.7)
    plt.plot(filtered_data['time'], filtered_data[channel], label=f'Filtered {channel}', alpha=0.7)
    plt.xlabel('Time (s)')
    plt.ylabel(channel.replace('_', ' ').title())
    plt.title(f'Original vs Filtered {channel.replace("_", " ").title()} Data')
    plt.legend()
    plt.grid()
    plt.show()