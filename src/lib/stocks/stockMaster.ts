// =====================================================================
// QUANTPULSE — Master Stock Universe & Metadata Registry
// Contains complete, official real-market information on ALL NIFTY 50
// and BSE SENSEX constituents (Official NSE Symbols, Market Short Names,
// Legal Registered Names, ISIN, Segment, Exchange, Sector, Dhan Security ID,
// Lot Size, Strike Step, 20-Day Baseline Traded Shares, Approx LTP, and Indices).
// =====================================================================

import { StockMasterItem, Stock } from '../types/quant';

export const STOCK_MASTER_CATALOG: StockMasterItem[] = [
  {
    ticker: 'ADANIENT',
    shortName: 'Adani Ent',
    name: 'Adani Enterprises Limited',
    isin: 'INE423A01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Metals, Mining & Trading',
    securityId: '25',
    lotSize: 300,
    strikeStep: 50,
    avgVol20DM: 2.60,
    approxLtp: 3050.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'ADANIPORTS',
    shortName: 'Adani Ports',
    name: 'Adani Ports and Special Economic Zone Limited',
    isin: 'INE742F01042',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Ports & Infrastructure',
    securityId: '15083',
    lotSize: 400,
    strikeStep: 20,
    avgVol20DM: 3.40,
    approxLtp: 1420.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'APOLLOHOSP',
    shortName: 'Apollo Hosp',
    name: 'Apollo Hospitals Enterprise Limited',
    isin: 'INE437A01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Healthcare & Hospitals',
    securityId: '157',
    lotSize: 125,
    strikeStep: 50,
    avgVol20DM: 0.70,
    approxLtp: 7100.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'ASIANPAINT',
    shortName: 'Asian Paints',
    name: 'Asian Paints Limited',
    isin: 'INE021A01026',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Paints & Consumer Goods',
    securityId: '236',
    lotSize: 200,
    strikeStep: 20,
    avgVol20DM: 1.10,
    approxLtp: 3250.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'AXISBANK',
    shortName: 'Axis Bank',
    name: 'Axis Bank Limited',
    isin: 'INE238A01034',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Private Banking',
    securityId: '5900',
    lotSize: 625,
    strikeStep: 20,
    avgVol20DM: 7.40,
    approxLtp: 1180.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'BAJAJ-AUTO',
    shortName: 'Bajaj Auto',
    name: 'Bajaj Auto Limited',
    isin: 'INE917I01010',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Automobile - 2 & 3 Wheelers',
    securityId: '16669',
    lotSize: 75,
    strikeStep: 100,
    avgVol20DM: 0.45,
    approxLtp: 9650.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'BAJFINANCE',
    shortName: 'Bajaj Finance',
    name: 'Bajaj Finance Limited',
    isin: 'INE296A01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Non-Banking Financial Services (NBFC)',
    securityId: '317',
    lotSize: 125,
    strikeStep: 100,
    avgVol20DM: 1.10,
    approxLtp: 7240.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'BAJAJFINSV',
    shortName: 'Bajaj Finserv',
    name: 'Bajaj Finserv Limited',
    isin: 'INE918I01018',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Financial Services & Insurance',
    securityId: '16675',
    lotSize: 500,
    strikeStep: 20,
    avgVol20DM: 1.60,
    approxLtp: 1820.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'BEL',
    shortName: 'Bharat Electronics',
    name: 'Bharat Electronics Limited',
    isin: 'INE263A01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Defence & Aerospace Electronics',
    securityId: '383',
    lotSize: 2850,
    strikeStep: 5,
    avgVol20DM: 22.00,
    approxLtp: 295.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'BHARTIARTL',
    shortName: 'Bharti Airtel',
    name: 'Bharti Airtel Limited',
    isin: 'INE397D01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Telecommunications',
    securityId: '10604',
    lotSize: 475,
    strikeStep: 20,
    avgVol20DM: 6.20,
    approxLtp: 1540.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'BPCL',
    shortName: 'BPCL',
    name: 'Bharat Petroleum Corporation Limited',
    isin: 'INE029A01011',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Oil Refining & Marketing',
    securityId: '526',
    lotSize: 1800,
    strikeStep: 5,
    avgVol20DM: 14.50,
    approxLtp: 355.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'BRITANNIA',
    shortName: 'Britannia',
    name: 'Britannia Industries Limited',
    isin: 'INE216A01030',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'FMCG & Bakery / Food Products',
    securityId: '547',
    lotSize: 100,
    strikeStep: 50,
    avgVol20DM: 0.55,
    approxLtp: 5900.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'CIPLA',
    shortName: 'Cipla',
    name: 'Cipla Limited',
    isin: 'INE059A01026',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Pharmaceuticals',
    securityId: '694',
    lotSize: 375,
    strikeStep: 20,
    avgVol20DM: 1.70,
    approxLtp: 1620.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'COALINDIA',
    shortName: 'Coal India',
    name: 'Coal India Limited',
    isin: 'INE522F01014',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Coal & Mining',
    securityId: '20374',
    lotSize: 2100,
    strikeStep: 5,
    avgVol20DM: 12.00,
    approxLtp: 510.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'DIVISLAB',
    shortName: 'Divis Lab',
    name: "Divi's Laboratories Limited",
    isin: 'INE361B01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Pharmaceuticals & Active Ingredients',
    securityId: '10940',
    lotSize: 100,
    strikeStep: 50,
    avgVol20DM: 0.60,
    approxLtp: 5300.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'DRREDDY',
    shortName: "Dr Reddy's",
    name: "Dr. Reddy's Laboratories Limited",
    isin: 'INE089A01023',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Pharmaceuticals',
    securityId: '881',
    lotSize: 125,
    strikeStep: 50,
    avgVol20DM: 0.70,
    approxLtp: 6600.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'EICHERMOT',
    shortName: 'Eicher Motors',
    name: 'Eicher Motors Limited',
    isin: 'INE066A01021',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Automobile Manufacturers (Royal Enfield)',
    securityId: '910',
    lotSize: 150,
    strikeStep: 50,
    avgVol20DM: 0.65,
    approxLtp: 4850.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'GRASIM',
    shortName: 'Grasim',
    name: 'Grasim Industries Limited',
    isin: 'INE047A01021',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Cement, Chemicals & Diversified',
    securityId: '1232',
    lotSize: 250,
    strikeStep: 20,
    avgVol20DM: 1.05,
    approxLtp: 2650.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'HCLTECH',
    shortName: 'HCL Tech',
    name: 'HCL Technologies Limited',
    isin: 'INE860A01027',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Information Technology',
    securityId: '7229',
    lotSize: 350,
    strikeStep: 20,
    avgVol20DM: 2.90,
    approxLtp: 1780.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'HDFCBANK',
    shortName: 'HDFC Bank',
    name: 'HDFC Bank Limited',
    isin: 'INE040A01034',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Private Banking & Financials',
    securityId: '1333',
    lotSize: 550,
    strikeStep: 20,
    avgVol20DM: 6.00,
    approxLtp: 1644.20,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'HDFCLIFE',
    shortName: 'HDFC Life',
    name: 'HDFC Life Insurance Company Limited',
    isin: 'INE795G01014',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Life Insurance',
    securityId: '467',
    lotSize: 1100,
    strikeStep: 10,
    avgVol20DM: 4.80,
    approxLtp: 715.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'HEROMOTOCO',
    shortName: 'Hero MotoCorp',
    name: 'Hero MotoCorp Limited',
    isin: 'INE158A01026',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Automobile - 2 & 3 Wheelers',
    securityId: '1348',
    lotSize: 150,
    strikeStep: 50,
    avgVol20DM: 0.55,
    approxLtp: 5650.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'HINDALCO',
    shortName: 'Hindalco',
    name: 'Hindalco Industries Limited',
    isin: 'INE038A01020',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Aluminium & Copper / Metals',
    securityId: '1363',
    lotSize: 1400,
    strikeStep: 10,
    avgVol20DM: 8.50,
    approxLtp: 715.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'HINDUNILVR',
    shortName: 'Hindustan Unilever',
    name: 'Hindustan Unilever Limited',
    isin: 'INE030A01027',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'FMCG & Consumer Goods',
    securityId: '1394',
    lotSize: 300,
    strikeStep: 50,
    avgVol20DM: 1.80,
    approxLtp: 2780.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'ICICIBANK',
    shortName: 'ICICI Bank',
    name: 'ICICI Bank Limited',
    isin: 'INE090A01021',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Private Banking & Financials',
    securityId: '4963',
    lotSize: 700,
    strikeStep: 20,
    avgVol20DM: 7.00,
    approxLtp: 1258.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'INDUSINDBK',
    shortName: 'IndusInd Bank',
    name: 'IndusInd Bank Limited',
    isin: 'INE095A01012',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Private Banking',
    securityId: '5258',
    lotSize: 500,
    strikeStep: 20,
    avgVol20DM: 3.80,
    approxLtp: 1440.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'INFY',
    shortName: 'Infosys',
    name: 'Infosys Limited',
    isin: 'INE009A01021',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Information Technology',
    securityId: '1594',
    lotSize: 400,
    strikeStep: 20,
    avgVol20DM: 6.80,
    approxLtp: 1890.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'ITC',
    shortName: 'ITC',
    name: 'ITC Limited',
    isin: 'INE154A01025',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'FMCG & Cigarettes / Hotels',
    securityId: '1660',
    lotSize: 1600,
    strikeStep: 10,
    avgVol20DM: 12.00,
    approxLtp: 495.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'JIOFIN',
    shortName: 'Jio Financial',
    name: 'Jio Financial Services Limited',
    isin: 'INE758E01017',
    segment: 'NSE_EQ',
    exchange: 'NSE',
    sector: 'Financial Services & NBFC',
    securityId: '18143',
    lotSize: 1,
    strikeStep: 5,
    avgVol20DM: 24.00,
    approxLtp: 340.00,
    isFnO: false,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'JSWSTEEL',
    shortName: 'JSW Steel',
    name: 'JSW Steel Limited',
    isin: 'INE019A01038',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Iron & Steel / Metals',
    securityId: '11723',
    lotSize: 675,
    strikeStep: 10,
    avgVol20DM: 2.70,
    approxLtp: 995.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'KOTAKBANK',
    shortName: 'Kotak Bank',
    name: 'Kotak Mahindra Bank Limited',
    isin: 'INE237A01028',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Private Banking',
    securityId: '1922',
    lotSize: 400,
    strikeStep: 20,
    avgVol20DM: 4.80,
    approxLtp: 1820.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'LT',
    shortName: 'L&T',
    name: 'Larsen & Toubro Limited',
    isin: 'INE018A01030',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Infrastructure & Engineering',
    securityId: '11483',
    lotSize: 150,
    strikeStep: 50,
    avgVol20DM: 2.10,
    approxLtp: 3560.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'LTIM',
    shortName: 'LTIMindtree',
    name: 'LTIMindtree Limited',
    isin: 'INE214T01019',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Information Technology',
    securityId: '17818',
    lotSize: 150,
    strikeStep: 50,
    avgVol20DM: 0.65,
    approxLtp: 6150.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'M&M',
    shortName: 'Mahindra & Mahindra',
    name: 'Mahindra & Mahindra Limited',
    isin: 'INE101A01026',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Automobile Manufacturers (SUVs & Tractors)',
    securityId: '2031',
    lotSize: 350,
    strikeStep: 20,
    avgVol20DM: 3.80,
    approxLtp: 3120.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'MARUTI',
    shortName: 'Maruti Suzuki',
    name: 'Maruti Suzuki India Limited',
    isin: 'INE585B01010',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Automobile Manufacturers',
    securityId: '10999',
    lotSize: 50,
    strikeStep: 200,
    avgVol20DM: 0.65,
    approxLtp: 12450.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'NESTLEIND',
    shortName: 'Nestle',
    name: 'Nestle India Limited',
    isin: 'INE239A01024',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'FMCG & Food Processing',
    securityId: '17963',
    lotSize: 250,
    strikeStep: 20,
    avgVol20DM: 0.85,
    approxLtp: 2650.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'NTPC',
    shortName: 'NTPC',
    name: 'NTPC Limited',
    isin: 'INE733E01010',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Power Generation & Utilities',
    securityId: '11630',
    lotSize: 1500,
    strikeStep: 5,
    avgVol20DM: 15.00,
    approxLtp: 425.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'ONGC',
    shortName: 'ONGC',
    name: 'Oil & Natural Gas Corporation Limited',
    isin: 'INE213A01029',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Oil Exploration & Production',
    securityId: '2475',
    lotSize: 3850,
    strikeStep: 2.5,
    avgVol20DM: 18.00,
    approxLtp: 295.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'POWERGRID',
    shortName: 'Power Grid',
    name: 'Power Grid Corporation of India Limited',
    isin: 'INE752E01010',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Power Transmission & Infrastructure',
    securityId: '14977',
    lotSize: 1800,
    strikeStep: 5,
    avgVol20DM: 13.00,
    approxLtp: 340.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'RELIANCE',
    shortName: 'Reliance',
    name: 'Reliance Industries Limited',
    isin: 'INE002A01018',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Oil & Gas / Conglomerate',
    securityId: '1330',
    lotSize: 250,
    strikeStep: 50,
    avgVol20DM: 5.20,
    approxLtp: 2968.50,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'SBILIFE',
    shortName: 'SBI Life',
    name: 'SBI Life Insurance Company Limited',
    isin: 'INE123W01016',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Life Insurance',
    securityId: '21808',
    lotSize: 750,
    strikeStep: 20,
    avgVol20DM: 1.50,
    approxLtp: 1780.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'SBIN',
    shortName: 'SBI',
    name: 'State Bank of India',
    isin: 'INE062A01020',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Public Sector Banking',
    securityId: '3045',
    lotSize: 750,
    strikeStep: 10,
    avgVol20DM: 14.50,
    approxLtp: 785.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'SHRIRAMFIN',
    shortName: 'Shriram Finance',
    name: 'Shriram Finance Limited',
    isin: 'INE721A01013',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Non-Banking Financial Services (NBFC)',
    securityId: '4306',
    lotSize: 150,
    strikeStep: 50,
    avgVol20DM: 1.80,
    approxLtp: 3350.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'SUNPHARMA',
    shortName: 'Sun Pharma',
    name: 'Sun Pharmaceutical Industries Limited',
    isin: 'INE044A01036',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Pharmaceuticals',
    securityId: '3351',
    lotSize: 350,
    strikeStep: 20,
    avgVol20DM: 2.80,
    approxLtp: 1860.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'TATACONSUM',
    shortName: 'Tata Consumer',
    name: 'Tata Consumer Products Limited',
    isin: 'INE192A01025',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'FMCG / Beverages & Food',
    securityId: '3432',
    lotSize: 900,
    strikeStep: 10,
    avgVol20DM: 2.20,
    approxLtp: 1180.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'TMCV',
    shortName: 'TMCV',
    name: 'TMCV',
    isin: 'INE155A01022',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Automobile Manufacturers (Commercial Vehicles)',
    securityId: '3456',
    lotSize: 550,
    strikeStep: 20,
    avgVol20DM: 8.90,
    approxLtp: 984.40,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'TATASTEEL',
    shortName: 'Tata Steel',
    name: 'Tata Steel Limited',
    isin: 'INE081A01020',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Iron & Steel / Metals',
    securityId: '3499',
    lotSize: 5500,
    strikeStep: 2.5,
    avgVol20DM: 32.00,
    approxLtp: 154.50,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'TCS',
    shortName: 'TCS',
    name: 'Tata Consultancy Services Limited',
    isin: 'INE467B01029',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Information Technology',
    securityId: '11536',
    lotSize: 175,
    strikeStep: 50,
    avgVol20DM: 1.50,
    approxLtp: 4126.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'TECHM',
    shortName: 'Tech Mahindra',
    name: 'Tech Mahindra Limited',
    isin: 'INE669C01036',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Information Technology',
    securityId: '13538',
    lotSize: 600,
    strikeStep: 20,
    avgVol20DM: 2.30,
    approxLtp: 1620.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'TITAN',
    shortName: 'Titan Company',
    name: 'Titan Company Limited',
    isin: 'INE280A01028',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Gems, Jewellery & Luxury',
    securityId: '3506',
    lotSize: 175,
    strikeStep: 50,
    avgVol20DM: 1.20,
    approxLtp: 3680.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'TRENT',
    shortName: 'Trent',
    name: 'Trent Limited',
    isin: 'INE849A01020',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Retail / Apparel & Lifestyle',
    securityId: '1964',
    lotSize: 100,
    strikeStep: 50,
    avgVol20DM: 1.80,
    approxLtp: 7450.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'ULTRACEMCO',
    shortName: 'UltraTech',
    name: 'UltraTech Cement Limited',
    isin: 'INE481G01011',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Cement & Building Materials',
    securityId: '11532',
    lotSize: 100,
    strikeStep: 100,
    avgVol20DM: 0.40,
    approxLtp: 11500.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'UPL',
    shortName: 'UPL',
    name: 'UPL Limited',
    isin: 'INE628A01036',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Agrochemicals & Crop Protection',
    securityId: '11287',
    lotSize: 1300,
    strikeStep: 5,
    avgVol20DM: 4.20,
    approxLtp: 570.00,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
  {
    ticker: 'WIPRO',
    shortName: 'Wipro',
    name: 'Wipro Limited',
    isin: 'INE075A01022',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Information Technology',
    securityId: '3787',
    lotSize: 1500,
    strikeStep: 10,
    avgVol20DM: 8.50,
    approxLtp: 535.00,
    isFnO: true,
    indices: ['NIFTY 50', 'SENSEX'],
  },
  {
    ticker: 'ETERNAL',
    shortName: 'ETERNAL',
    name: 'ETERNAL',
    isin: 'INE758T01015',
    segment: 'NSE_FNO',
    exchange: 'NSE',
    sector: 'Online Food Delivery & Quick Commerce',
    securityId: '5097',
    lotSize: 2500,
    strikeStep: 5,
    avgVol20DM: 19.00,
    approxLtp: 264.80,
    isFnO: true,
    indices: ['NIFTY 50'],
  },
];

/**
 * Normalizes any ticker symbol by removing exchange suffixes (.NS, .BO, .BSE, .NSE),
 * segment tags (-EQ, -BE, -SM), and extraneous whitespace.
 */
export function normalizeTicker(ticker: string): string {
  if (!ticker) return '';
  let clean = ticker.trim().toUpperCase();
  clean = clean.replace(/\.(NS|BO|BSE|NSE)$/i, '');
  clean = clean.replace(/-(EQ|BE|SM)$/i, '');
  clean = clean.trim();
  if (clean === 'TATAMOTORS') return 'TMCV';
  if (clean === 'ZOMATO') return 'ETERNAL';
  return clean;
}

/**
 * Finds master stock info by ticker with fuzzy, alphanumeric, ISIN, and securityId resolution
 */
export function getStockMasterByTicker(ticker: string): StockMasterItem | undefined {
  if (!ticker) return undefined;
  const clean = normalizeTicker(ticker);

  // 1. Direct match on clean ticker (handles TMCV & ETERNAL directly via normalizeTicker)
  let found = STOCK_MASTER_CATALOG.find((s) => s.ticker === clean);
  if (found) return found;

  // 1b. Direct alias support for TMCV / TATAMOTORS and ETERNAL / ZOMATO
  if (clean === 'TMCV' || clean === 'TATAMOTORS') {
    found = STOCK_MASTER_CATALOG.find((s) => s.ticker === 'TMCV');
    if (found) return found;
  }
  if (clean === 'ETERNAL' || clean === 'ZOMATO') {
    found = STOCK_MASTER_CATALOG.find((s) => s.ticker === 'ETERNAL');
    if (found) return found;
  }

  // 2. Direct match ignoring dashes/underscores/special chars (e.g. BAJAJ-AUTO vs BAJAJAUTO, M&M vs MM)
  const stripped = clean.replace(/[^A-Z0-9]/g, '');
  if (stripped) {
    found = STOCK_MASTER_CATALOG.find((s) => s.ticker.replace(/[^A-Z0-9]/g, '') === stripped);
    if (found) return found;
  }

  // 3. Match by ISIN if ticker happens to be an ISIN (e.g. INE155A01022 -> TMCV, INE758T01015 -> ETERNAL)
  found = STOCK_MASTER_CATALOG.find((s) => s.isin && s.isin.toUpperCase() === clean);
  if (found) return found;

  // 4. Match by Dhan security ID (e.g. 3456 -> TMCV/TMCV, 5097 -> ETERNAL/ETERNAL)
  found = STOCK_MASTER_CATALOG.find((s) => s.securityId === clean);
  if (found) return found;

  // 5. Match by exact shortName or full name (case-insensitive)
  found = STOCK_MASTER_CATALOG.find(
    (s) =>
      (s.shortName && s.shortName.toUpperCase() === clean) ||
      (s.name && s.name.toUpperCase() === clean)
  );
  if (found) return found;

  return undefined;
}

export interface ResolvedStockMetadata {
  ticker: string;
  shortName: string;
  name: string;
  isin: string;
  segment: 'NSE_FNO' | 'NSE_EQ';
  sector: string;
  securityId: string;
  lotSize: number;
  strikeStep: number;
  avgVol20DM: number;
  approxLtp: number;
  isFnO: boolean;
  indices: string[];
}

/**
 * Resolves authoritative stock metadata, ensuring the true corporate name and friendly short name
 * are never overridden by raw tickers or placeholder strings (e.g. "(Cash Only)", "(Stock Only)").
 */
export function resolveStockMetadata(
  input: {
    ticker?: string;
    shortName?: string;
    short_name?: string;
    name?: string;
    isin?: string;
    segment?: string;
    sector?: string;
    securityId?: string;
    security_id?: string;
    lotSize?: number;
    lot_size?: number;
    strikeStep?: number;
    strike_step?: number;
    isFnO?: boolean;
    is_fno?: boolean;
    avgVol20DM?: number;
    avg_vol_20d_m?: number;
    todayVolM?: number;
    today_vol_m?: number;
    spotLtp?: number;
    spot_ltp?: number;
    approxLtp?: number;
    approx_ltp?: number;
    indices?: string[];
    [key: string]: any;
  },
  dbMasterItem?: Partial<StockMasterItem>
): ResolvedStockMetadata {
  const rawTicker = input.ticker || dbMasterItem?.ticker || '';
  const cleanTicker = normalizeTicker(rawTicker);

  // Explicit corporate restructuring & rebranding overrides
  if (cleanTicker === 'TMCV' || cleanTicker === 'TATAMOTORS') {
    return {
      ticker: 'TMCV',
      shortName: 'TMCV',
      name: 'TMCV',
      isin: 'INE155A01022',
      isFnO: true,
      segment: 'NSE_FNO',
      sector: 'Automobile Manufacturers (Commercial Vehicles)',
      securityId: '3456',
      lotSize: 550,
      strikeStep: 20,
      avgVol20DM: input.avgVol20DM || input.avg_vol_20d_m || 8.90,
      approxLtp: input.spotLtp || input.spot_ltp || input.approxLtp || 984.40,
      indices: ['NIFTY 50', 'SENSEX'],
    };
  }
  if (cleanTicker === 'ETERNAL' || cleanTicker === 'ZOMATO') {
    return {
      ticker: 'ETERNAL',
      shortName: 'ETERNAL',
      name: 'ETERNAL',
      isin: 'INE758T01015',
      isFnO: true,
      segment: 'NSE_FNO',
      sector: 'Online Food Delivery & Quick Commerce',
      securityId: '5097',
      lotSize: 2500,
      strikeStep: 5,
      avgVol20DM: input.avgVol20DM || input.avg_vol_20d_m || 19.00,
      approxLtp: input.spotLtp || input.spot_ltp || input.approxLtp || 264.80,
      indices: ['NIFTY 50'],
    };
  }

  const catalogItem = getStockMasterByTicker(cleanTicker);
  const master = catalogItem || (dbMasterItem as StockMasterItem | undefined);

  // 1. Authoritative Corporate Name
  // Curated master catalog is authoritative. If not found in catalog, fallback to DB item, then sanitize input name.
  let officialName = catalogItem?.name || dbMasterItem?.name;
  if (!officialName) {
    const rawName = (input.name || '').trim();
    if (rawName && rawName.toUpperCase() !== cleanTicker && !rawName.includes('(Cash Only)')) {
      officialName = rawName;
    } else {
      officialName = `${cleanTicker} Limited`;
    }
  }

  // 2. Authoritative Friendly Short Name
  // Priority: Curated catalog shortName -> DB master shortName -> input shortName (if distinct from ticker) -> cleanTicker
  const candidateShort = (input.shortName || input.short_name || '').trim();
  let officialShortName = catalogItem?.shortName || dbMasterItem?.shortName;
  if (!officialShortName) {
    if (candidateShort && candidateShort.toUpperCase() !== cleanTicker) {
      officialShortName = candidateShort;
    } else {
      officialShortName = cleanTicker;
    }
  }

  const isFnO =
    master?.isFnO ??
    (input.isFnO !== undefined
      ? Boolean(input.isFnO)
      : input.is_fno !== undefined
      ? Boolean(input.is_fno)
      : true);

  const segment = (master?.segment ||
    input.segment ||
    (isFnO ? 'NSE_FNO' : 'NSE_EQ')) as 'NSE_FNO' | 'NSE_EQ';

  const isin = master?.isin || input.isin || '';
  const sector = master?.sector || input.sector || 'General';
  const securityId = master?.securityId || input.securityId || input.security_id || '1330';
  const lotSize = Number(master?.lotSize ?? input.lotSize ?? input.lot_size ?? 1);
  const strikeStep = Number(master?.strikeStep ?? input.strikeStep ?? input.strike_step ?? 50);
  const avgVol20DM = Number(master?.avgVol20DM ?? input.avgVol20DM ?? input.avg_vol_20d_m ?? 1.0);
  const approxLtp = Number(
    master?.approxLtp ??
      input.approxLtp ??
      input.approx_ltp ??
      input.spotLtp ??
      input.spot_ltp ??
      1000.0
  );
  const indices = master?.indices || input.indices || [];

  return {
    ticker: cleanTicker,
    shortName: officialShortName,
    name: officialName,
    isin,
    segment,
    sector,
    securityId,
    lotSize,
    strikeStep,
    avgVol20DM,
    approxLtp,
    isFnO,
    indices,
  };
}

/**
 * Converts a StockMasterItem or metadata object into a live tracking Stock object with exact real market names
 */
export function convertMasterToStock(master: StockMasterItem | Partial<StockMasterItem>): Stock {
  const meta = resolveStockMetadata(master);
  return {
    ticker: meta.ticker,
    shortName: meta.shortName,
    name: meta.name,
    isFnO: meta.isFnO,
    segment: meta.segment,
    sector: meta.sector,
    securityId: meta.securityId,
    isin: meta.isin,
    lotSize: meta.lotSize,
    strikeStep: meta.strikeStep,
    spotLtp: meta.approxLtp,
    todayVolM: 0.0,
    avgVol20DM: meta.avgVol20DM,
    hasCrossed20D: false,
    crossoverTime: null,
    crossoverSpotPrice: null,
    ivPct: meta.isFnO ? 16.5 : 0,
    justCrossedHighlight: false,
    feedSource: 'LIVE_DHAN',
    indices: meta.indices,
  };
}
