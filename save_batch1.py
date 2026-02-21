import json
import csv
import os

# Data for Batch 1
data = {
    "6862.HK": [{"close":"16.384","open":"15.624","low":"15.564","high":"16.684","volume":23624433,"turnover":"451092260.000","timestamp":"2022-01-20T16:00:00Z"},
{"close":"16.564","open":"16.204","low":"15.644","high":"16.784","volume":25497771,"turnover":"493113892.000","timestamp":"2022-01-23T16:00:00Z"},
{"close":"15.264","open":"16.044","low":"15.124","high":"16.504","volume":17869695,"turnover":"329788316.000","timestamp":"2022-01-24T16:00:00Z"},
{"close":"14.744","open":"15.224","low":"14.604","high":"15.344","volume":12207500,"turnover":"216696667.000","timestamp":"2022-01-25T16:00:00Z"},
{"close":"13.884","open":"14.724","low":"13.644","high":"14.724","volume":9274460,"turnover":"156006439.000","timestamp":"2022-01-26T16:00:00Z"},
{"close":"13.504","open":"14.004","low":"13.264","high":"14.204","volume":7295383,"turnover":"119965476.000","timestamp":"2022-01-27T16:00:00Z"},
{"close":"13.904","open":"13.524","low":"13.304","high":"14.164","volume":4211000,"turnover":"70082420.000","timestamp":"2022-01-30T16:00:00Z"},
{"close":"15.284","open":"14.264","low":"13.884","high":"15.384","volume":13980937,"turnover":"248520263.000","timestamp":"2022-02-03T16:00:00Z"},
{"close":"15.204","open":"15.244","low":"14.584","high":"15.344","volume":13648445,"turnover":"243822362.000","timestamp":"2022-02-06T16:00:00Z"},
{"close":"14.924","open":"15.204","low":"14.644","high":"15.484","volume":10722863,"turnover":"192073635.000","timestamp":"2022-02-07T16:00:00Z"},
{"close":"15.524","open":"15.224","low":"15.064","high":"15.744","volume":9967811,"turnover":"182444478.000","timestamp":"2022-02-08T16:00:00Z"},
{"close":"16.424","open":"15.904","low":"15.584","high":"16.424","volume":21906920,"turnover":"416416431.000","timestamp":"2022-02-09T16:00:00Z"},
{"close":"17.274","open":"16.384","low":"15.824","high":"17.474","volume":34527010,"turnover":"683305041.000","timestamp":"2022-02-10T16:00:00Z"},
{"close":"17.224","open":"17.274","low":"16.944","high":"17.674","volume":15205175,"turnover":"306879176.000","timestamp":"2022-02-13T16:00:00Z"},
{"close":"17.064","open":"17.174","low":"16.564","high":"17.374","volume":9813832,"turnover":"194311306.000","timestamp":"2022-02-14T16:00:00Z"},
{"close":"17.274","open":"17.674","low":"16.924","high":"18.424","volume":14947378,"turnover":"303996593.000","timestamp":"2022-02-15T16:00:00Z"},
{"close":"17.974","open":"17.424","low":"17.324","high":"18.274","volume":22263241,"turnover":"461328625.000","timestamp":"2022-02-16T16:00:00Z"},
{"close":"17.324","open":"17.724","low":"17.124","high":"17.824","volume":8463297,"turnover":"172066501.000","timestamp":"2022-02-17T16:00:00Z"},
{"close":"16.204","open":"16.724","low":"15.944","high":"18.124","volume":29036599,"turnover":"562978569.000","timestamp":"2022-02-20T16:00:00Z"},
{"close":"16.044","open":"16.604","low":"15.624","high":"16.604","volume":14769523,"turnover":"277745120.000","timestamp":"2022-02-21T16:00:00Z"},
{"close":"16.404","open":"16.224","low":"15.744","high":"16.924","volume":15229804,"turnover":"293078281.000","timestamp":"2022-02-22T16:00:00Z"},
{"close":"15.604","open":"15.724","low":"15.444","high":"16.344","volume":15300519,"turnover":"285273557.000","timestamp":"2022-02-23T16:00:00Z"},
{"close":"15.584","open":"15.684","low":"15.424","high":"16.244","volume":8519377,"turnover":"158426889.000","timestamp":"2022-02-24T16:00:00Z"},
{"close":"15.044","open":"15.704","low":"14.684","high":"15.704","volume":14509094,"turnover":"259334006.000","timestamp":"2022-02-27T16:00:00Z"},
{"close":"15.184","open":"15.144","low":"15.124","high":"15.664","volume":8198743,"turnover":"149524245.000","timestamp":"2022-02-28T16:00:00Z"},
{"close":"14.964","open":"15.244","low":"14.684","high":"15.344","volume":10115900,"turnover":"180126619.000","timestamp":"2022-03-01T16:00:00Z"},
{"close":"15.644","open":"15.444","low":"15.384","high":"16.024","volume":13143167,"turnover":"244171360.000","timestamp":"2022-03-02T16:00:00Z"},
{"close":"14.384","open":"15.424","low":"14.224","high":"15.424","volume":19107296,"turnover":"335722429.000","timestamp":"2022-03-03T16:00:00Z"},
{"close":"12.524","open":"14.124","low":"12.424","high":"14.124","volume":28281496,"turnover":"451849494.000","timestamp":"2022-03-06T16:00:00Z"},
{"close":"11.744","open":"12.644","low":"11.684","high":"12.844","volume":19076648,"turnover":"285396103.000","timestamp":"2022-03-07T16:00:00Z"},
{"close":"11.564","open":"11.884","low":"10.744","high":"12.164","volume":22042543,"turnover":"314495476.000","timestamp":"2022-03-08T16:00:00Z"},
{"close":"11.404","open":"12.404","low":"11.184","high":"12.604","volume":21674389,"turnover":"318301097.000","timestamp":"2022-03-09T16:00:00Z"},
{"close":"10.804","open":"11.304","low":"9.744","high":"11.304","volume":31634275,"turnover":"418340613.000","timestamp":"2022-03-10T16:00:00Z"},
{"close":"8.344","open":"10.144","low":"8.164","high":"10.144","volume":47918936,"turnover":"555068017.000","timestamp":"2022-03-13T16:00:00Z"},
{"close":"7.204","open":"7.664","low":"7.124","high":"8.784","volume":46463987,"turnover":"496110065.000","timestamp":"2022-03-14T16:00:00Z"},
{"close":"9.344","open":"7.824","low":"7.484","high":"9.604","volume":61093445,"turnover":"708759509.000","timestamp":"2022-03-15T16:00:00Z"},
{"close":"10.764","open":"11.124","low":"9.644","high":"11.124","volume":37257790,"turnover":"491044126.000","timestamp":"2022-03-16T16:00:00Z"},
{"close":"10.984","open":"10.724","low":"9.864","high":"11.384","volume":22916227,"turnover":"308082898.000","timestamp":"2022-03-17T16:00:00Z"},
{"close":"9.864","open":"11.324","low":"9.664","high":"11.344","volume":24878902,"turnover":"324172156.000","timestamp":"2022-03-20T16:00:00Z"},
{"close":"9.904","open":"9.844","low":"9.504","high":"10.084","volume":21948479,"turnover":"277202801.000","timestamp":"2022-03-21T16:00:00Z"},
{"close":"10.364","open":"10.004","low":"9.984","high":"11.084","volume":33341721,"turnover":"448709226.000","timestamp":"2022-03-22T16:00:00Z"},
{"close":"11.604","open":"10.364","low":"10.084","high":"11.884","volume":49859890,"turnover":"706764341.000","timestamp":"2022-03-23T16:00:00Z"},
{"close":"10.484","open":"11.804","low":"10.284","high":"12.664","volume":49610504,"turnover":"706368742.000","timestamp":"2022-03-24T16:00:00Z"},
{"close":"11.224","open":"10.424","low":"9.624","high":"11.324","volume":29635201,"turnover":"399374664.000","timestamp":"2022-03-27T16:00:00Z"},
{"close":"12.384","open":"11.604","low":"10.964","high":"12.624","volume":29238801,"turnover":"431732475.000","timestamp":"2022-03-28T16:00:00Z"},
{"close":"12.544","open":"12.364","low":"11.884","high":"12.724","volume":22858075,"turnover":"349749576.000","timestamp":"2022-03-29T16:00:00Z"},
{"close":"12.484","open":"12.524","low":"11.824","high":"12.844","volume":14215022,"turnover":"216650853.000","timestamp":"2022-03-30T16:00:00Z"},
{"close":"11.984","open":"12.184","low":"11.584","high":"12.204","volume":13974131,"turnover":"207449387.000","timestamp":"2022-03-31T16:00:00Z"},
{"close":"12.384","open":"12.144","low":"11.964","high":"12.604","volume":10440943,"turnover":"158891493.000","timestamp":"2022-04-03T16:00:00Z"},
{"close":"12.404","open":"12.164","low":"11.764","high":"12.404","volume":14111367,"turnover":"212431056.000","timestamp":"2022-04-05T16:00:00Z"},
{"close":"11.304","open":"12.384","low":"11.124","high":"12.504","volume":22437200,"turnover":"325594056.000","timestamp":"2022-04-06T16:00:00Z"},
{"close":"11.244","open\":\"11.284","low":"10.744","high":"11.424","volume":10971860,"turnover":"153976553.000","timestamp":"2022-04-07T16:00:00Z"},
{"close":"9.884","open":"11.224","low":"9.644","high":"11.224","volume":22822700,"turnover":"296114945.000","timestamp":"2022-04-10T16:00:00Z"},
{"close":"11.144","open":"9.864","low":"9.824","high":"11.204","volume":38157764,"turnover":"512537078.000","timestamp":"2022-04-11T16:00:00Z"},
{"close":"11.804","open":"11.124","low":"10.844","high":"12.204","volume":27242905,"turnover":"395480154.000","timestamp":"2022-04-12T16:00:00Z"},
{"close":"13.284","open":"12.004","low":"11.844","high":"13.324","volume":34564949,"turnover":"542395594.000","timestamp":"2022-04-13T16:00:00Z"},
{"close":"12.904","open":"12.624","low":"12.004","high":"13.424","volume":23122796,"turnover":"361328995.000","timestamp":"2022-04-18T16:00:00Z"},
{"close":"13.164","open":"12.904","low":"12.524","high":"13.864","volume":19798749,"turnover":"320552449.000","timestamp":"2022-04-19T16:00:00Z"},
{"close":"12.024","open":"13.264","low":"11.924","high":"13.364","volume":24447187,"turnover":"374016339.000","timestamp":"2022-04-20T16:00:00Z"},
{"close":"12.464","open":"12.004","low":"11.164","high":"12.644","volume":19023558,"turnover":"284104092.000","timestamp":"2022-04-21T16:00:00Z"},
{"close":"10.044","open":"11.684","low":"10.004","high":"11.924","volume":39326238,"turnover":"531864471.000","timestamp":"2022-04-24T16:00:00Z"},
{"close":"10.624","open":"10.264","low":"10.084","high":"11.384","volume":41924907,"turnover":"572102738.000","timestamp":"2022-04-25T16:00:00Z"},
{"close":"12.164","open":"10.324","low":"10.224","high":"12.204","volume":37704654,"turnover":"536312400.000","timestamp":"2022-04-26T16:00:00Z"},
{"close":"12.184","open":"12.164","low":"11.704","high":"12.324","volume":14214541,"turnover":"211318842.000","timestamp":"2022-04-27T16:00:00Z"},
{"close":"12.784","open":"12.184","low":"11.564","high":"13.004","volume":14888161,"turnover":"227422590.000","timestamp":"2022-04-28T16:00:00Z"},
{"close":"12.864","open":"12.924","low":"12.144","high":"12.964","volume":9678182,"turnover":"150368899.000","timestamp":"2022-05-02T16:00:00Z"},
{"close":"11.924","open":"12.864","low":"11.764","high":"12.864","volume":9319358,"turnover":"139422454.000","timestamp":"2022-05-03T16:00:00Z"},
{"close":"11.724","open":"12.124","low":"11.624","high":"12.424","volume":14186475,"turnover":"212135680.000","timestamp":"2022-05-04T16:00:00Z"},
{"close":"10.704","open":"11.124","low":"10.444","high":"11.204","volume":22101234,"turnover":"300372758.000","timestamp":"2022-05-05T16:00:00Z"},
{"close":"10.584","open":"10.104","low":"9.624","high":"10.904","volume":17123168,"turnover":"227443478.000","timestamp":"2022-05-09T16:00:00Z"},
{"close":"10.864","open":"10.584","low":"10.124","high":"11.444","volume":30160791,"turnover":"416512428.000","timestamp":"2022-05-10T16:00:00Z"},
{"close":"10.484","open":"10.744","low":"10.204","high":"11.064","volume":16726601,"turnover":"224559100.000","timestamp":"2022-05-11T16:00:00Z"},
{"close":"10.424","open":"10.644","low":"10.024","high":"10.724","volume":25072568,"turnover":"328979452.000","timestamp":"2022-05-12T16:00:00Z"},
{"close":"11.304","open":"10.944","low":"10.684","high":"11.484","volume":30230034,"turnover":"424644828.000","timestamp":"2022-05-15T16:00:00Z"},
{"close":"11.384","open":"11.284","low":"11.004","high":"11.464","volume":15784582,"turnover":"223400287.000","timestamp":"2022-05-16T16:00:00Z"},
{"close":"11.144","open":"11.424","low":"10.784","high":"11.444","volume":13790407,"turnover":"192212601.000","timestamp":"2022-05-17T16:00:00Z"},
{"close":"10.684","open":"10.624","low":"10.524","high":"11.004","volume":11331710,"turnover":"153833212.000","timestamp":"2022-05-18T16:00:00Z"},
{"close":"11.044","open":"10.764","low":"10.704","high":"11.244","volume":13756447,"turnover":"190931047.000","timestamp":"2022-05-19T16:00:00Z"},
{"close":"10.744","open":"10.924","low":"10.484","high":"10.964","volume":14281019,"turnover":"194653088.000","timestamp":"2022-05-22T16:00:00Z"},
{"close":"10.224","open":"10.824","low":"10.124","high":"10.944","volume":15928144,"turnover":"211933785.000","timestamp":"2022-05-23T16:00:00Z"},
{"close":"10.444","open":"10.104","low":"10.104","high":"10.724","volume":13569333,"turnover":"181825678.000","timestamp":"2022-05-24T16:00:00Z"},
{"close":"10.584","open":"10.544","low":"10.264","high":"10.684","volume":7042057,"turnover":"94041535.000","timestamp":"2022-05-25T16:00:00Z"},
{"close":"10.504","open":"10.864","low":"10.244","high":"10.964","volume":11951000,"turnover":"160719223.000","timestamp":"2022-05-26T16:00:00Z"},
{"close":"11.804","open":"10.824","low":"10.824","high":"11.924","volume":35030675,"turnover":"503975255.000","timestamp":"2022-05-29T16:00:00Z"},
{"close":"12.724","open":"11.824","low":"11.644","high":"12.784","volume":28042584,"turnover":"428353072.000","timestamp":"2022-05-30T16:00:00Z"},
{"close":"12.564","open":"12.704","low":"12.184","high":"13.064","volume":15213632,"turnover":"234703459.000","timestamp":"2022-05-31T16:00:00Z"},
{"close":"11.944","open":"12.384","low":"11.824","high":"12.584","volume":15151340,"turnover":"226079580.000","timestamp":"2022-06-01T16:00:00Z"},
{"close":"13.004","open":"12.224","low":"12.124","high":"13.024","volume":14116310,"turnover":"218506494.000","timestamp":"2022-06-05T16:00:00Z"},
{"close":"12.924","open":"12.744","low":"12.624","high":"13.384","volume":16297613,"turnover":"259255036.000","timestamp":"2022-06-06T16:00:00Z"},
{"close":"13.844","open":"13.044","low":"13.044","high":"13.904","volume":22809056,"turnover":"375133394.000","timestamp":"2022-06-07T16:00:00Z"},
{"close":"13.004","open":"13.704","low":"12.704","high":"14.304","volume":26740553,"turnover":"437310854.000","timestamp":"2022-06-08T16:00:00Z"},
{"close":"12.824","open":"12.524","low":"12.264","high":"13.244","volume":23695766,"turnover":"370889309.000","timestamp":"2022-06-09T16:00:00Z"},
{"close":"11.984","open":"12.244","low":"11.764","high":"12.584","volume":17767657,"turnover":"266556364.000","timestamp":"2022-06-12T16:00:00Z"},
{"close":"11.944","open":"11.764","low":"11.484","high":"12.084","volume":13571042,"turnover":"198798063.000","timestamp":"2022-06-13T16:00:00Z"},
{"close":"12.284","open":"11.944","low":"11.904","high":"12.384","volume":12222187,"turnover":"184227351.000","timestamp":"2022-06-14T16:00:00Z"},
{"close":"11.684","open":"12.324","low":"11.464","high":"12.784","volume":16535398,"turnover":"247712525.000","timestamp":"2022-06-15T16:00:00Z"},
{"close":"12.304","open":"11.704","low":"11.684","high":"12.404","volume":12649223,"turnover":"190907581.000","timestamp":"2022-06-16T16:00:00Z"},
{"close":"12.504","open":"12.124","low":"12.044","high":"12.624","volume":10589316,"turnover":"162207101.000","timestamp":"2022-06-19T16:00:00Z"},
{"close":"12.644","open":"12.644","low":"12.344","high":"12.824","volume":15758650,"turnover":"243716407.000","timestamp":"2022-06-20T16:00:00Z"},
{"close":"12.024","open":"12.784","low":"11.924","high":"12.964","volume":11411065,"turnover":"172610751.000","timestamp":"2022-06-21T16:00:00Z"},
{"close":"12.244","open":"12.244","low":"12.024","high":"12.444","volume":7077938,"turnover":"106879164.000","timestamp":"2022-06-22T16:00:00Z"}
]
}

def write_csv(filename, records):
    if not records:
        return
    
    # Define CSV header
    header = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Turnover']
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        
        for r in records:
            # Parse timestamp to YYYY-MM-DD
            dt = r.get('timestamp', '').split('T')[0]
            
            row = [
                dt,
                r.get('open', ''),
                r.get('high', ''),
                r.get('low', ''),
                r.get('close', ''),
                r.get('volume', ''),
                r.get('turnover', '')
            ]
            writer.writerow(row)

# Target directory
output_dir = r"D:\code\stock-claude-RALPH\股票数据"
os.makedirs(output_dir, exist_ok=True)

for symbol, records in data.items():
    file_path = os.path.join(output_dir, f"{symbol}.csv")
    write_csv(file_path, records)
    print(f"Written {file_path}")
