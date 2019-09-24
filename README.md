# speed-prediction
An OSRM predictive speed profiler using Uber Movement Speed data

## Install

```sh
git clone 
git@github.com:sharedstreets/speed-prediction.git
cd speed-prediction
npm install
```

## Download

Download all Uber speed files for a city into your project directory, along with an OSM extract for the corresponding area.

## Run

This will run the process with 8GB of RAM. It is not necessary to provide more RAM, and the process will likely run with much less. Expect the entire process to take about 2 hours for a major metropolitan area.

```sh
time node --max-old-space-size=8192 index.js
```

## Format

The output format is the standard OSRM csv format for traffic profiles described [here](https://github.com/Project-OSRM/osrm-backend/wiki/Traffic). There is one profile per day of week and hour of day, 0 indexed. For example, Sunday at midnight is described in the profile `0-0`, whereas the Tuesday noon profile is described in `2-12`. OSRM is designed to load exactly one profile at a time, so for ETA or isochrone analysis, you would cycle through your times of interest, loading a new profile after each batch.
