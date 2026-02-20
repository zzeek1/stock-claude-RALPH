#!/bin/bash
# 统计 Claude API token 使用量

LOG_DIR=".ralph/logs"
TOTAL_INPUT=0
TOTAL_OUTPUT=0

echo "=== Token 使用统计 ==="
echo ""

for log in $LOG_DIR/claude_output_*.log; do
    if [ -f "$log" ]; then
        # 提取 input_tokens 和 output_tokens
        INPUT=$(grep -o '"input_tokens":[0-9]*' "$log" | sed 's/"input_tokens"://' | awk '{sum+=$1} END {print sum}')
        OUTPUT=$(grep -o '"output_tokens":[0-9]*' "$log" | sed 's/"output_tokens"://' | awk '{sum+=$1} END {print sum}')

        if [ -n "$INPUT" ]; then
            TOTAL_INPUT=$((TOTAL_INPUT + INPUT))
        fi
        if [ -n "$OUTPUT" ]; then
            TOTAL_OUTPUT=$((TOTAL_OUTPUT + OUTPUT))
        fi
    fi
done

echo "输入 Tokens: $TOTAL_INPUT"
echo "输出 Tokens: $TOTAL_OUTPUT"
echo "总计: $((TOTAL_INPUT + TOTAL_OUTPUT))"
echo ""
echo "估算费用 (Claude 3.5 Sonnet):"
INPUT_COST=$(echo "scale=4; $TOTAL_INPUT * 0.003 / 1000" | bc)
OUTPUT_COST=$(echo "scale=4; $TOTAL_OUTPUT * 0.015 / 1000" | bc)
TOTAL_COST=$(echo "scale=4; $INPUT_COST + $OUTPUT_COST" | bc)
echo "输入费用: \$$INPUT_COST"
echo "输出费用: \$$OUTPUT_COST"
echo "总费用: \$$TOTAL_COST"
